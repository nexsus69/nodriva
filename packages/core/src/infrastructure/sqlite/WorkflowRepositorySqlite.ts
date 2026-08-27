/** SQLite persistence for the generic workflow catalogue and durable idempotency keys. */
import type { WorkflowOperationalStats, WorkflowRepository } from '../../application/ports/WorkflowRepository.js';
import type {
  EventTypeDefinition,
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowExecutionPlan,
  WorkflowExecutionStep,
  WorkflowStepDefinition,
} from '../../domain/events/WorkflowEvent.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

interface EventTypeRow {
  event_type: string;
  subject_kinds: string;
  payload_version: number;
  is_active: number;
}

interface WorkflowDefinitionRow {
  definition_payload: string;
  is_active: number;
}

interface WorkflowExecutionStepRow {
  execution_key: string;
  instance_key: string;
  workflow_id: string;
  workflow_version: number;
  event_payload: string;
  step_id: string;
  action_type: string;
  input_payload: string;
}

interface WorkflowOperationalStatsRow {
  pending_count: number;
  leased_count: number;
  retrying_count: number;
  oldest_pending_age_seconds: number;
  max_attempts: number;
}

/** Keeps JSON serialization at the adapter boundary while preserving the shared port contract. */
export class WorkflowRepositorySqlite implements WorkflowRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async registerEventType(definition: EventTypeDefinition): Promise<void> {
    this.database.run(
      `INSERT INTO workflow_event_types (event_type, subject_kinds, payload_version, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(event_type) DO UPDATE SET
         subject_kinds=excluded.subject_kinds,
         payload_version=excluded.payload_version,
         is_active=excluded.is_active,
         updated_at=excluded.updated_at`,
      [definition.eventType, JSON.stringify(definition.subjectKinds), definition.payloadVersion, definition.isActive ? 1 : 0, new Date().toISOString()],
    );
  }

  async findEventType(eventType: string): Promise<EventTypeDefinition | null> {
    const row = this.database.get<EventTypeRow>(
      'SELECT event_type, subject_kinds, payload_version, is_active FROM workflow_event_types WHERE event_type=?',
      [eventType],
    );
    return row ? this.mapEventType(row) : null;
  }

  async listEventTypes(): Promise<EventTypeDefinition[]> {
    return this.database.all<EventTypeRow>(
      'SELECT event_type, subject_kinds, payload_version, is_active FROM workflow_event_types ORDER BY event_type ASC',
    ).map((row) => this.mapEventType(row));
  }

  async saveDefinition(definition: WorkflowDefinition): Promise<boolean> {
    return this.database.transaction(() => {
      const result = this.database.run(
        `INSERT INTO workflow_definitions (workflow_id, version, definition_payload, is_active, updated_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(workflow_id, version) DO NOTHING`,
        [definition.workflowId, definition.version, JSON.stringify(definition), new Date().toISOString()],
      );
      if (result.changes !== 1) return false;
      if (definition.isActive) {
        this.database.run(
          `UPDATE workflow_definitions SET is_active=0, updated_at=?
           WHERE workflow_id=? AND version<>? AND is_active=1`,
          [new Date().toISOString(), definition.workflowId, definition.version],
        );
        this.database.run(
          'UPDATE workflow_definitions SET is_active=1, updated_at=? WHERE workflow_id=? AND version=?',
          [new Date().toISOString(), definition.workflowId, definition.version],
        );
      }
      return true;
    });
  }

  async findDefinition(workflowId: string, version: number): Promise<WorkflowDefinition | null> {
    const row = this.database.get<WorkflowDefinitionRow>(
      'SELECT definition_payload, is_active FROM workflow_definitions WHERE workflow_id=? AND version=?', [workflowId, version],
    );
    return row ? this.mapDefinition(row) : null;
  }

  async listDefinitions(): Promise<WorkflowDefinition[]> {
    return this.database.all<WorkflowDefinitionRow>(
      'SELECT definition_payload, is_active FROM workflow_definitions ORDER BY workflow_id ASC, version DESC',
    ).map((row) => this.mapDefinition(row));
  }

  async listActiveDefinitions(eventType: string): Promise<WorkflowDefinition[]> {
    const rows = this.database.all<WorkflowDefinitionRow>(
      `SELECT definition_payload, is_active FROM workflow_definitions
       WHERE is_active=1 ORDER BY workflow_id ASC, version ASC`,
    );
    return rows
      .map((row) => this.mapDefinition(row))
      .filter((definition) => definition.triggerEventTypes.includes(eventType));
  }

  async recordEvent(event: WorkflowEvent): Promise<boolean> {
    const result = this.database.run(
      `INSERT OR IGNORE INTO workflow_events
       (event_id, event_type, subject_kind, subject_id, scope_id, event_payload, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventId,
        event.eventType,
        event.subject.kind,
        event.subject.id,
        event.subject.scopeId ?? null,
        JSON.stringify(event),
        event.occurredAt,
      ],
    );
    return result.changes === 1;
  }

  async recordPlan(plan: WorkflowExecutionPlan): Promise<boolean> {
    return this.database.transaction(() => {
      const result = this.database.run(
        `INSERT OR IGNORE INTO workflow_execution_plans
         (instance_key, workflow_id, workflow_version, event_id, plan_payload)
         VALUES (?, ?, ?, ?, ?)`,
        [plan.instanceKey, plan.workflowId, plan.workflowVersion, plan.eventId, JSON.stringify(plan)],
      );
      if (result.changes === 0) return false;
      for (const step of plan.steps) {
        this.database.run(
          `INSERT INTO workflow_execution_steps
           (execution_key, instance_key, step_id, action_type, input_payload)
           VALUES (?, ?, ?, ?, ?)`,
          [step.executionKey, plan.instanceKey, step.stepId, step.actionType, JSON.stringify(step.input)],
        );
      }
      if (plan.steps.length === 0) {
        this.database.run("UPDATE workflow_execution_plans SET status='completed' WHERE instance_key=?", [plan.instanceKey]);
      }
      return true;
    });
  }

  async claimPendingSteps(workerId: string, limit: number): Promise<WorkflowExecutionStep[]> {
    const now = new Date().toISOString();
    const leaseExpired = new Date(Date.now() - 5 * 60_000).toISOString();
    return this.database.transaction(() => {
      const rows = this.database.all<WorkflowExecutionStepRow>(
        `SELECT step.execution_key, step.instance_key, plan.workflow_id, plan.workflow_version,
                event.event_payload, step.step_id, step.action_type, step.input_payload
         FROM workflow_execution_steps step
         JOIN workflow_execution_plans plan ON plan.instance_key=step.instance_key
         JOIN workflow_events event ON event.event_id=plan.event_id
         WHERE (step.status='pending' AND (step.next_attempt_at IS NULL OR step.next_attempt_at<=?))
            OR (step.status='leased' AND step.locked_at<?)
         ORDER BY step.created_at ASC LIMIT ?`,
        [now, leaseExpired, limit],
      );
      const claimed: WorkflowExecutionStep[] = [];
      for (const row of rows) {
        const update = this.database.run(
          `UPDATE workflow_execution_steps SET status='leased', locked_at=?, locked_by=?
           WHERE execution_key=? AND (status='pending' OR (status='leased' AND locked_at<?))`,
          [now, workerId, row.execution_key, leaseExpired],
        );
        if (update.changes === 1) claimed.push(this.mapExecutionStep(row));
      }
      return claimed;
    });
  }

  async markStepCompleted(executionKey: string, workerId: string): Promise<void> {
    this.database.transaction(() => {
      const result = this.database.run(
        `UPDATE workflow_execution_steps
         SET status='completed', completed_at=?, locked_at=NULL, locked_by=NULL, last_error=NULL
         WHERE execution_key=? AND status='leased' AND locked_by=?`,
        [new Date().toISOString(), executionKey, workerId],
      );
      if (result.changes === 0) return;
      this.database.run(
        `UPDATE workflow_execution_plans SET status='completed'
         WHERE instance_key=(SELECT instance_key FROM workflow_execution_steps WHERE execution_key=?)
           AND NOT EXISTS (
             SELECT 1 FROM workflow_execution_steps
             WHERE instance_key=workflow_execution_plans.instance_key AND status<>'completed'
           )`,
        [executionKey],
      );
    });
  }

  async markStepFailed(executionKey: string, workerId: string, error: string): Promise<void> {
    const row = this.database.get<{ attempts: number }>(
      "SELECT attempts FROM workflow_execution_steps WHERE execution_key=? AND status='leased' AND locked_by=?",
      [executionKey, workerId],
    );
    if (!row) return;
    const attempts = row.attempts + 1;
    const delay = Math.min(2 ** Math.min(attempts, 8), 900) * 1000;
    this.database.run(
      `UPDATE workflow_execution_steps
       SET status='pending', attempts=?, next_attempt_at=?, locked_at=NULL, locked_by=NULL, last_error=?
       WHERE execution_key=? AND status='leased' AND locked_by=?`,
      [attempts, new Date(Date.now() + delay).toISOString(), error.slice(0, 1000), executionKey, workerId],
    );
  }

  async getOperationalStats(): Promise<WorkflowOperationalStats> {
    const row = this.database.get<WorkflowOperationalStatsRow>(
      `SELECT
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN status='leased' THEN 1 ELSE 0 END) AS leased_count,
         SUM(CASE WHEN status='pending' AND attempts>0 THEN 1 ELSE 0 END) AS retrying_count,
         CAST(MAX(0, COALESCE((julianday('now') - julianday(MIN(CASE WHEN status='pending' THEN created_at END))) * 86400, 0)) AS INTEGER) AS oldest_pending_age_seconds,
         COALESCE(MAX(attempts), 0) AS max_attempts
       FROM workflow_execution_steps`,
    );
    return {
      pendingCount: row?.pending_count ?? 0,
      leasedCount: row?.leased_count ?? 0,
      retryingCount: row?.retrying_count ?? 0,
      oldestPendingAgeSeconds: row?.oldest_pending_age_seconds ?? 0,
      maxAttempts: row?.max_attempts ?? 0,
    };
  }

  private mapEventType(row: EventTypeRow): EventTypeDefinition {
    return {
      eventType: row.event_type,
      subjectKinds: JSON.parse(row.subject_kinds) as string[],
      payloadVersion: row.payload_version,
      isActive: row.is_active === 1,
    };
  }

  /** Keeps activation lifecycle metadata outside the immutable definition payload. */
  private mapDefinition(row: WorkflowDefinitionRow): WorkflowDefinition {
    return { ...JSON.parse(row.definition_payload) as WorkflowDefinition, isActive: row.is_active === 1 };
  }

  private mapExecutionStep(row: WorkflowExecutionStepRow): WorkflowExecutionStep {
    return {
      executionKey: row.execution_key,
      instanceKey: row.instance_key,
      workflowId: row.workflow_id,
      workflowVersion: row.workflow_version,
      event: JSON.parse(row.event_payload) as WorkflowEvent,
      step: {
        stepId: row.step_id,
        actionType: row.action_type,
        input: JSON.parse(row.input_payload) as Readonly<Record<string, unknown>>,
      } satisfies WorkflowStepDefinition,
    };
  }
}
