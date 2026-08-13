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

  async delete(id: string): Promise<void> { await this.executor.query('DELETE FROM resource_attachments WHERE id=$1', [id]); }

  async deleteForResource(resourceType: AttachmentRecord['resourceType'], resourceId: string): Promise<string[]> {
    const result = await this.executor.query<{ storage_key: string }>('DELETE FROM resource_attachments WHERE resource_type=$1 AND resource_id=$2 RETURNING storage_key', [resourceType, resourceId]);
    return result.rows.map((row) => row.storage_key);
  }
}
