import type { AuditPort } from '../../application/ports/AuditPort.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

export class AuditPortSqlite implements AuditPort {
  constructor(private readonly database: SqliteDatabase) {}
  async record(actorUserId: string | null, actionKey: string, resourceKind: string, resourceId: string, nodeId: string | null, beforePayload: Record<string, unknown> | null, afterPayload: Record<string, unknown> | null): Promise<void> {
    this.database.run('INSERT INTO audit_logs (actor_user_id,action_key,resource_kind,resource_id,node_id,before_payload,after_payload) VALUES (?,?,?,?,?,?,?)', [actorUserId, actionKey, resourceKind, resourceId, nodeId, beforePayload ? JSON.stringify(beforePayload) : null, afterPayload ? JSON.stringify(afterPayload) : null]);
  }
}
