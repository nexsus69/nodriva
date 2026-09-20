/** PostgreSQL persistence for generic workflow definitions, events and idempotent plans. */
import type { WorkflowOperationalStats, WorkflowRepository } from '../../application/ports/WorkflowRepository.js';
import type {
  EventTypeDefinition,
  WorkflowDefinition,
  WorkflowDefinitionListPageDto,
  WorkflowDefinitionListPageParams,
  WorkflowEvent,
  WorkflowExecutionPlan,
  WorkflowExecutionStep,
  WorkflowStepDefinition,
} from '../../domain/events/WorkflowEvent.js';
import type { PgExecutor } from './PgExecutor.js';

interface EventTypeRow {
  event_type: string;
  subject_kinds: string[];
  payload_version: number;
  is_active: boolean;
}

interface WorkflowDefinitionRow {
  definition_payload: WorkflowDefinition;
  is_active: boolean;
}

interface WorkflowExecutionStepRow {
  execution_key: string;
  instance_key: string;
  workflow_id: string;
  workflow_version: number;
  event_payload: WorkflowEvent;
  step_id: string;
  action_type: string;
  input_payload: Record<string, unknown>;
}

interface WorkflowOperationalStatsRow {
  pending_count: number;
  leased_count: number;
  retrying_count: number;
  oldest_pending_age_seconds: number;
  max_attempts: number;
}

/** Uses JSONB only as durable configuration data; workflow rules remain in the Domain/Application layers. */
export class WorkflowRepositoryPostgres implements WorkflowRepository {
  constructor(private readonly executor: PgExecutor) {}

  async registerEventType(definition: EventTypeDefinition): Promise<void> {
    await this.executor.query(
      `INSERT INTO workflow_event_types (event_type, subject_kinds, payload_version, is_active, updated_at)
       VALUES ($1, $2::jsonb, $3, $4, now())
       ON CONFLICT(event_type) DO UPDATE SET
         subject_kinds=EXCLUDED.subject_kinds,
         payload_version=EXCLUDED.payload_version,
         is_active=EXCLUDED.is_active,
         updated_at=now()`,
      [definition.eventType, JSON.stringify(definition.subjectKinds), definition.payloadVersion, definition.isActive],
    );
  }

  async findEventType(eventType: string): Promise<EventTypeDefinition | null> {
    const result = await this.executor.query<EventTypeRow>(
      'SELECT event_type, subject_kinds, payload_version, is_active FROM workflow_event_types WHERE event_type=$1',
      [eventType],
    );
    const row = result.rows[0];
    return row ? {
      eventType: row.event_type,
      subjectKinds: row.subject_kinds,
      payloadVersion: row.payload_version,
      isActive: row.is_active,
    } : null;
  }

  async listEventTypes(): Promise<EventTypeDefinition[]> {
    const result = await this.executor.query<EventTypeRow>(
      'SELECT event_type, subject_kinds, payload_version, is_active FROM workflow_event_types ORDER BY event_type ASC',
    );
    return result.rows.map((row) => ({
      eventType: row.event_type, subjectKinds: row.subject_kinds, payloadVersion: row.payload_version, isActive: row.is_active,
    }));
  }

  async saveDefinition(definition: WorkflowDefinition): Promise<boolean> {
    return this.executor.runInTransaction(async () => {
      await this.executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [definition.workflowId]);
      const inserted = await this.executor.query(
        `INSERT INTO workflow_definitions (workflow_id, version, definition_payload, is_active, updated_at)
         VALUES ($1, $2, $3::jsonb, false, now())
         ON CONFLICT(workflow_id, version) DO NOTHING
         RETURNING workflow_id`,
        [definition.workflowId, definition.version, JSON.stringify(definition)],
      );
      if (inserted.rowCount !== 1) return false;
      if (!definition.isActive) return true;
      await this.executor.query(
        `UPDATE workflow_definitions SET is_active=false, updated_at=now()
         WHERE workflow_id=$1 AND version<>$2 AND is_active=true`,
        [definition.workflowId, definition.version],
      );
      await this.executor.query(
        'UPDATE workflow_definitions SET is_active=true, updated_at=now() WHERE workflow_id=$1 AND version=$2',
        [definition.workflowId, definition.version],
      );
      return true;
    });
  }

  async findDefinition(workflowId: string, version: number): Promise<WorkflowDefinition | null> {
    const result = await this.executor.query<WorkflowDefinitionRow>(
      'SELECT definition_payload, is_active FROM workflow_definitions WHERE workflow_id=$1 AND version=$2', [workflowId, version],
    );
    return result.rows[0] ? this.mapDefinition(result.rows[0]) : null;
  }

  async findLatestDefinitionVersion(workflowId: string): Promise<number> {
    const result = await this.executor.query<{ version: number | null }>('SELECT MAX(version) AS version FROM workflow_definitions WHERE workflow_id=$1', [workflowId]);
    return Number(result.rows[0]?.version ?? 0);
  }

  async listDefinitions(): Promise<WorkflowDefinition[]> {
    const result = await this.executor.query<WorkflowDefinitionRow>(
      'SELECT definition_payload, is_active FROM workflow_definitions ORDER BY workflow_id ASC, version DESC',
    );
    return result.rows.map((row) => this.mapDefinition(row));
  }

  async listDefinitionsPage(params: WorkflowDefinitionListPageParams): Promise<WorkflowDefinitionListPageDto> {
    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, Math.max(1, params.pageSize));
    const search = params.search?.trim() ?? '';
    const pattern = `%${search}%`;
    const orderBy = {
      workflowId: "workflow_id",
      name: "COALESCE(definition_payload->>'name', workflow_id)",
      version: 'version',
      status: 'is_active',
    }[params.sort?.key ?? 'workflowId'];
    const direction = params.sort?.direction === 'descending' ? 'DESC' : 'ASC';
    const where = `WHERE ($1 = '' OR workflow_id ILIKE $2 OR COALESCE(definition_payload->>'name', '') ILIKE $2 OR COALESCE(definition_payload->>'description', '') ILIKE $2)`;
    const count = await this.executor.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM workflow_definitions ${where}`, [search, pattern]);
    const total = Number(count.rows[0]?.total ?? 0);
    const result = await this.executor.query<WorkflowDefinitionRow>(
      `SELECT definition_payload, is_active FROM workflow_definitions ${where}
       ORDER BY ${orderBy} ${direction}, workflow_id ASC, version DESC LIMIT $3 OFFSET $4`,
      [search, pattern, pageSize, (page - 1) * pageSize],
    );
    return { items: result.rows.map((row) => this.mapDefinition(row)), total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async listActiveDefinitions(eventType: string): Promise<WorkflowDefinition[]> {
    const result = await this.executor.query<WorkflowDefinitionRow>(
      `SELECT definition_payload, is_active FROM workflow_definitions
       WHERE is_active=true ORDER BY workflow_id ASC, version ASC`,
    );
    return result.rows
      .map((row) => this.mapDefinition(row))
      .filter((definition) => definition.triggerEventTypes.includes(eventType));
  }

  async recordEvent(event: WorkflowEvent): Promise<boolean> {
    const result = await this.executor.query(
      `INSERT INTO workflow_events
       (event_id, event_type, subject_kind, subject_id, scope_id, event_payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
       ON CONFLICT(event_id) DO NOTHING`,
      [event.eventId, event.eventType, event.subject.kind, event.subject.id, event.subject.scopeId ?? null, JSON.stringify(event), event.occurredAt],
    );
    return result.rowCount === 1;
  }

  async recordPlan(plan: WorkflowExecutionPlan): Promise<boolean> {
    const result = await this.executor.query(
      `INSERT INTO workflow_execution_plans
       (instance_key, workflow_id, workflow_version, event_id, plan_payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT(instance_key) DO NOTHING`,
      [plan.instanceKey, plan.workflowId, plan.workflowVersion, plan.eventId, JSON.stringify(plan)],
    );
    if (result.rowCount !== 1) return false;
    for (const step of plan.steps) {
      await this.executor.query(
        `INSERT INTO workflow_execution_steps
         (execution_key, instance_key, step_id, action_type, input_payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [step.executionKey, plan.instanceKey, step.stepId, step.actionType, JSON.stringify(step.input)],
      );
    }
    if (plan.steps.length === 0) {
      await this.executor.query("UPDATE workflow_execution_plans SET status='completed' WHERE instance_key=$1", [plan.instanceKey]);
    }
    return true;
  }

  async claimPendingSteps(workerId: string, limit: number): Promise<WorkflowExecutionStep[]> {
    const result = await this.executor.query<WorkflowExecutionStepRow>(
      `WITH candidates AS (
         SELECT step.execution_key
         FROM workflow_execution_steps step
         WHERE (step.status='pending' AND (step.next_attempt_at IS NULL OR step.next_attempt_at<=now()))
            OR (step.status='leased' AND step.locked_at < now() - interval '5 minutes')
         ORDER BY step.created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       )
       UPDATE workflow_execution_steps step
       SET status='leased', locked_at=now(), locked_by=$1
       FROM candidates, workflow_execution_plans plan, workflow_events event
       WHERE step.execution_key=candidates.execution_key
         AND plan.instance_key=step.instance_key
         AND event.event_id=plan.event_id
       RETURNING step.execution_key, step.instance_key, plan.workflow_id, plan.workflow_version,
                 event.event_payload, step.step_id, step.action_type, step.input_payload`,
      [workerId, limit],
    );
    return result.rows.map((row) => this.mapExecutionStep(row));
  }

  async markStepCompleted(executionKey: string, workerId: string): Promise<void> {
    await this.executor.query(
      `WITH completed AS (
         UPDATE workflow_execution_steps
         SET status='completed', completed_at=now(), locked_at=NULL, locked_by=NULL, last_error=NULL
         WHERE execution_key=$1 AND status='leased' AND locked_by=$2
         RETURNING instance_key
       )
       UPDATE workflow_execution_plans plan
       SET status='completed'
       FROM completed
       WHERE plan.instance_key=completed.instance_key
         AND NOT EXISTS (
           SELECT 1 FROM workflow_execution_steps step
           WHERE step.instance_key=plan.instance_key AND step.status<>'completed'
         )`,
      [executionKey, workerId],
    );
  }

  async markStepFailed(executionKey: string, workerId: string, error: string): Promise<void> {
    await this.executor.query(
      `UPDATE workflow_execution_steps
       SET status='pending', attempts=attempts+1,
           next_attempt_at=now() + LEAST((2 ^ LEAST(attempts + 1, 8)) * interval '1 second', interval '15 minutes'),
           locked_at=NULL, locked_by=NULL, last_error=$2
       WHERE execution_key=$1 AND status='leased' AND locked_by=$3`,
      [executionKey, error.slice(0, 1000), workerId],
    );
  }

  async getOperationalStats(): Promise<WorkflowOperationalStats> {
    const result = await this.executor.query<WorkflowOperationalStatsRow>(
      `SELECT
         COUNT(*) FILTER (WHERE status='pending') AS pending_count,
         COUNT(*) FILTER (WHERE status='leased') AS leased_count,
         COUNT(*) FILTER (WHERE status='pending' AND attempts>0) AS retrying_count,
         COALESCE(EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (WHERE status='pending'))), 0)::integer AS oldest_pending_age_seconds,
         COALESCE(MAX(attempts), 0) AS max_attempts
       FROM workflow_execution_steps`,
    );
    const row = result.rows[0];
    return {
      pendingCount: Number(row?.pending_count ?? 0),
      leasedCount: Number(row?.leased_count ?? 0),
      retryingCount: Number(row?.retrying_count ?? 0),
      oldestPendingAgeSeconds: Number(row?.oldest_pending_age_seconds ?? 0),
      maxAttempts: Number(row?.max_attempts ?? 0),
    };
  }

  private mapExecutionStep(row: WorkflowExecutionStepRow): WorkflowExecutionStep {
    return {
      executionKey: row.execution_key,
      instanceKey: row.instance_key,
      workflowId: row.workflow_id,
      workflowVersion: row.workflow_version,
      event: row.event_payload,
      step: {
        stepId: row.step_id,
        actionType: row.action_type,
        input: row.input_payload,
      } satisfies WorkflowStepDefinition,
    };
  }

  /** Keeps activation lifecycle metadata outside the immutable definition payload. */
  private mapDefinition(row: WorkflowDefinitionRow): WorkflowDefinition {
    return { ...row.definition_payload, isActive: row.is_active };
  }
}
