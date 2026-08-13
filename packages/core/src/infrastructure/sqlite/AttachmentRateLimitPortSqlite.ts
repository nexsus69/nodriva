import type { AttachmentRateLimitPort } from '../../application/ports/AttachmentRateLimitPort.js';
import type { SqliteDatabase } from './SqliteDatabase.js';

export class AttachmentRateLimitPortSqlite implements AttachmentRateLimitPort {
  constructor(private readonly database: SqliteDatabase) {}

  async consume(actorId: string, limit: number, now = new Date()): Promise<boolean> {
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    return this.database.transaction(() => {
      this.database.run('DELETE FROM attachment_upload_events WHERE actor_id=? AND occurred_at<=?', [actorId, windowStart]);
      const count = Number(this.database.get<{ count: number }>('SELECT COUNT(*) AS count FROM attachment_upload_events WHERE actor_id=? AND occurred_at>?', [actorId, windowStart])?.count ?? 0);
      if (count >= limit) return false;
      this.database.run('INSERT INTO attachment_upload_events(actor_id,occurred_at) VALUES (?,?)', [actorId, now.toISOString()]);
      return true;
    });
  }
}
