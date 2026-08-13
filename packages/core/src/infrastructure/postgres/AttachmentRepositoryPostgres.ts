import type { AttachmentRecord, AttachmentRepository } from '../../application/ports/AttachmentRepository.js';
import type { PgExecutor } from './PgExecutor.js';

export class AttachmentRepositoryPostgres implements AttachmentRepository {
  constructor(private readonly executor: PgExecutor) {}

  async list(resourceType: AttachmentRecord['resourceType'], resourceId: string, fieldKey?: string): Promise<AttachmentRecord[]> {
    const result = await this.executor.query<AttachmentRecord>(
      'SELECT id, resource_type AS "resourceType", resource_id AS "resourceId", field_key AS "fieldKey", kind, file_name AS "fileName", mime_type AS "mimeType", size_bytes AS "sizeBytes", storage_key AS "storageKey", checksum, created_by AS "createdBy" FROM resource_attachments WHERE resource_type=$1 AND resource_id=$2 AND ($3=\'\' OR field_key=$3) ORDER BY created_at DESC',
      [resourceType, resourceId, fieldKey ?? ''],
    );
    return result.rows;
  }

  async getById(id: string): Promise<AttachmentRecord | null> {
    const result = await this.executor.query<AttachmentRecord>('SELECT id, resource_type AS "resourceType", resource_id AS "resourceId", field_key AS "fieldKey", kind, file_name AS "fileName", mime_type AS "mimeType", size_bytes AS "sizeBytes", storage_key AS "storageKey", checksum, created_by AS "createdBy" FROM resource_attachments WHERE id=$1', [id]);
    return result.rows[0] ?? null;
  }

  async getResourceQuota(resourceType: AttachmentRecord['resourceType'], resourceId: string): Promise<number> {
    const result = await this.executor.query<{ total: string }>('SELECT COALESCE(SUM(size_bytes),0)::text AS total FROM resource_attachments WHERE resource_type=$1 AND resource_id=$2', [resourceType, resourceId]);
    return Number(result.rows[0]?.total ?? 0);
  }

  async create(record: AttachmentRecord): Promise<void> {
    await this.executor.query('INSERT INTO resource_attachments (id,resource_type,resource_id,field_key,kind,file_name,mime_type,size_bytes,storage_key,checksum,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [record.id, record.resourceType, record.resourceId, record.fieldKey, record.kind, record.fileName, record.mimeType, record.sizeBytes, record.storageKey, record.checksum, record.createdBy]);
  }

  async createWithinQuota(record: AttachmentRecord, maximumResourceBytes: number): Promise<boolean> {
    const result = await this.executor.query<{ id: string }>(
      `WITH resource_lock AS MATERIALIZED (
         SELECT pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text, 0))
       ), quota AS (
         SELECT COALESCE(SUM(size_bytes),0) AS used_bytes FROM resource_attachments, resource_lock
         WHERE resource_type=$1 AND resource_id=$2::uuid
       )
       INSERT INTO resource_attachments (id,resource_type,resource_id,field_key,kind,file_name,mime_type,size_bytes,storage_key,checksum,created_by)
       SELECT $3,$1,$2::uuid,$4,$5,$6,$7,$8::bigint,$9,$10,$11 FROM quota
       WHERE quota.used_bytes + $8::bigint <= $12::bigint
       RETURNING id`,
      [record.resourceType, record.resourceId, record.id, record.fieldKey, record.kind, record.fileName, record.mimeType, record.sizeBytes, record.storageKey, record.checksum, record.createdBy, maximumResourceBytes],
    );
    return result.rows.length === 1;
  }

  async delete(id: string): Promise<void> { await this.executor.query('DELETE FROM resource_attachments WHERE id=$1', [id]); }

  async deleteForResource(resourceType: AttachmentRecord['resourceType'], resourceId: string): Promise<string[]> {
    const result = await this.executor.query<{ storage_key: string }>('DELETE FROM resource_attachments WHERE resource_type=$1 AND resource_id=$2 RETURNING storage_key', [resourceType, resourceId]);
    return result.rows.map((row) => row.storage_key);
  }
}
