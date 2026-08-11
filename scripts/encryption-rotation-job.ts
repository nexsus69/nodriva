import pg from '../packages/web/node_modules/pg/lib/index.js';
import { randomUUID } from 'node:crypto';
import { FieldEncryptionService } from '../packages/core/dist/index.js';
import { LocalAttachmentStorage } from '../packages/web/src/server/LocalAttachmentStorage.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const batchSize = Math.max(1, Math.min(1000, Number(process.env.ENCRYPTION_ROTATION_BATCH_SIZE ?? 100)));
const actorId = process.env.ENCRYPTION_ROTATION_ACTOR_ID ?? null;
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
const executor = { query: <T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) => pool.query<T>(text, params) };
const config = { get: async <T>(key: string): Promise<T> => (key === 'data.fieldsEncryptionEnabled' ? true as T : false as T) };
const fieldEncryption = new FieldEncryptionService(executor as never, config as never);
const attachmentStorage = new LocalAttachmentStorage();

async function audit(jobId: string, actionKey: string, payload: Record<string, unknown>): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (actor_user_id, action_key, resource_kind, resource_id, node_id, before_payload, after_payload)
     VALUES ($1, $2, 'system_setting'::resource_kind_enum, $3, NULL, NULL, $4)`,
    [actorId, actionKey, jobId, JSON.stringify(payload)],
  );
}

async function main(): Promise<void> {
  const activeVersion = process.env.FIELD_ENCRYPTION_ACTIVE_VERSION ?? process.env.ATTACHMENTS_ENCRYPTION_ACTIVE_VERSION ?? 'v1';
  const jobId = randomUUID();
  await pool.query(
    `INSERT INTO encryption_rotation_jobs (id, status, target_key_version, batch_size) VALUES ($1, 'running', $2, $3)`,
    [jobId, activeVersion, batchSize],
  );
  await audit(jobId, 'security.encryption_rotation.start', { targetKeyVersion: activeVersion, batchSize });
  try {
    let fieldsProcessed = 0;
    while (true) {
      const count = await fieldEncryption.rotateBatch(batchSize);
      fieldsProcessed += count;
      await pool.query('UPDATE encryption_rotation_jobs SET fields_processed = $1, updated_at = NOW() WHERE id = $2', [fieldsProcessed, jobId]);
      if (count === 0) break;
    }

    let attachmentsProcessed = 0;
    let lastId: string | null = null;
    while (true) {
      const result = await pool.query<{ id: string; storage_key: string }>(
        `SELECT id, storage_key FROM resource_attachments
         WHERE ($1::uuid IS NULL OR id > $1::uuid)
         ORDER BY id LIMIT $2`, [lastId, batchSize],
      );
      if (result.rows.length === 0) break;
      for (const row of result.rows) {
        if (await attachmentStorage.rotate(row.storage_key)) attachmentsProcessed += 1;
        lastId = row.id;
      }
      await pool.query('UPDATE encryption_rotation_jobs SET attachments_processed = $1, last_attachment_id = $2, updated_at = NOW() WHERE id = $3', [attachmentsProcessed, lastId, jobId]);
    }
    await pool.query("UPDATE encryption_rotation_jobs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1", [jobId]);
    await audit(jobId, 'security.encryption_rotation.completed', { fieldsProcessed, attachmentsProcessed });
    console.log(JSON.stringify({ jobId, status: 'completed', fieldsProcessed, attachmentsProcessed }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query("UPDATE encryption_rotation_jobs SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2", [message, jobId]);
    await audit(jobId, 'security.encryption_rotation.failed', { error: message });
    throw error;
  } finally {
    await pool.end();
  }
}

void main();
