import type { AttachmentRecord, AttachmentRepository } from '../../application/ports/AttachmentRepository.js';
import { SqliteDatabase } from './SqliteDatabase.js';

export class AttachmentRepositorySqlite implements AttachmentRepository {
  constructor(private readonly database: SqliteDatabase) {}

  async list(resourceType: AttachmentRecord['resourceType'], resourceId: string, fieldKey?: string): Promise<AttachmentRecord[]> {
    return this.database.all<AttachmentRecord>('SELECT id,resource_type AS resourceType,resource_id AS resourceId,field_key AS fieldKey,kind,file_name AS fileName,mime_type AS mimeType,size_bytes AS sizeBytes,storage_key AS storageKey,checksum,created_by AS createdBy FROM resource_attachments WHERE resource_type=? AND resource_id=? AND (?=\'\' OR field_key=?) ORDER BY created_at DESC', [resourceType, resourceId, fieldKey ?? '', fieldKey ?? '']);
  }

  async getById(id: string): Promise<AttachmentRecord | null> { return this.database.get<AttachmentRecord>('SELECT id,resource_type AS resourceType,resource_id AS resourceId,field_key AS fieldKey,kind,file_name AS fileName,mime_type AS mimeType,size_bytes AS sizeBytes,storage_key AS storageKey,checksum,created_by AS createdBy FROM resource_attachments WHERE id=?', [id]) ?? null; }
  async getResourceQuota(resourceType: AttachmentRecord['resourceType'], resourceId: string): Promise<number> { return Number(this.database.get<{ total: number }>('SELECT COALESCE(SUM(size_bytes),0) AS total FROM resource_attachments WHERE resource_type=? AND resource_id=?', [resourceType, resourceId])?.total ?? 0); }
  async create(record: AttachmentRecord): Promise<void> { this.database.run('INSERT INTO resource_attachments (id,resource_type,resource_id,field_key,kind,file_name,mime_type,size_bytes,storage_key,checksum,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [record.id, record.resourceType, record.resourceId, record.fieldKey, record.kind, record.fileName, record.mimeType, record.sizeBytes, record.storageKey, record.checksum, record.createdBy]); }
  async delete(id: string): Promise<void> { this.database.run('DELETE FROM resource_attachments WHERE id=?', [id]); }
  async deleteForResource(resourceType: AttachmentRecord['resourceType'], resourceId: string): Promise<string[]> { const rows = this.database.all<{ storage_key: string }>('SELECT storage_key FROM resource_attachments WHERE resource_type=? AND resource_id=?', [resourceType, resourceId]); this.database.run('DELETE FROM resource_attachments WHERE resource_type=? AND resource_id=?', [resourceType, resourceId]); return rows.map((row) => row.storage_key); }
}
