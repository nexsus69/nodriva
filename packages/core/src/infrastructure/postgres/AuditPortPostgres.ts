import type { AuditPort } from '../../application/ports/AuditPort.js';
import type { PgExecutor } from './PgExecutor.js';

/**
 * Adapter PostgreSQL per la registrazione dei log di audit.
 * Scrive le entry nella tabella `audit_logs` con mapping automatico a JSONB per i payload.
 */
export class AuditPortPostgres implements AuditPort {
  constructor(private readonly executor: PgExecutor) {}

  async record(
    actorUserId: string | null,
    actionKey: string,
    resourceKind: string,
    resourceId: string,
    nodeId: string | null,
    beforePayload: Record<string, unknown> | null,
    afterPayload: Record<string, unknown> | null
  ): Promise<void> {
    const query = `
      INSERT INTO audit_logs (
        actor_user_id,
        action_key,
        resource_kind,
        resource_id,
        node_id,
        before_payload,
        after_payload
      ) VALUES ($1, $2, $3::resource_kind_enum, $4, $5, $6, $7)
    `;

    await this.executor.query(query, [
      actorUserId,
      actionKey,
      resourceKind,
      resourceId,
      nodeId,
      beforePayload ? JSON.stringify(beforePayload) : null,
      afterPayload ? JSON.stringify(afterPayload) : null,
    ]);
  }
}
