import type { AttachmentEncryptionMode, AttachmentPolicyRepository } from '../../application/ports/AttachmentPolicyRepository.js';
import type { PgExecutor } from './PgExecutor.js';
export class AttachmentPolicyRepositoryPostgres implements AttachmentPolicyRepository {
  constructor(private readonly executor: PgExecutor) {}
  async getEncryptionMode(nodeTypeId: string): Promise<AttachmentEncryptionMode> { return (await this.executor.query<{ encryption_mode: AttachmentEncryptionMode }>('SELECT encryption_mode FROM node_type_attachment_policies WHERE node_type_id=$1', [nodeTypeId])).rows[0]?.encryption_mode ?? 'disabled'; }
  async setEncryptionMode(nodeTypeId: string, mode: AttachmentEncryptionMode): Promise<void> { await this.executor.query('INSERT INTO node_type_attachment_policies (node_type_id,encryption_mode,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (node_type_id) DO UPDATE SET encryption_mode=EXCLUDED.encryption_mode,updated_at=EXCLUDED.updated_at', [nodeTypeId, mode]); }
}
