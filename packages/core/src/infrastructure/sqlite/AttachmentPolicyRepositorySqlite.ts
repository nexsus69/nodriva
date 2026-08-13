import type { AttachmentEncryptionMode, AttachmentPolicyRepository } from '../../application/ports/AttachmentPolicyRepository.js';
import type { SqliteDatabase } from './SqliteDatabase.js';
export class AttachmentPolicyRepositorySqlite implements AttachmentPolicyRepository {
  constructor(private readonly database: SqliteDatabase) {}
  async getEncryptionMode(nodeTypeId: string): Promise<AttachmentEncryptionMode> { return this.database.get<{ encryption_mode: AttachmentEncryptionMode }>('SELECT encryption_mode FROM node_type_attachment_policies WHERE node_type_id=?', [nodeTypeId])?.encryption_mode ?? 'disabled'; }
  async setEncryptionMode(nodeTypeId: string, mode: AttachmentEncryptionMode): Promise<void> { this.database.run('INSERT INTO node_type_attachment_policies (node_type_id,encryption_mode,updated_at) VALUES (?,?,?) ON CONFLICT(node_type_id) DO UPDATE SET encryption_mode=excluded.encryption_mode,updated_at=excluded.updated_at', [nodeTypeId, mode, new Date().toISOString()]); }
}
