import type { AccessControlPort, AttachmentStoragePort, AuditPort, PgExecutor, TransactionPort } from '@dashboard/core';

interface AttachmentRow { storage_key: string; }

export class DeletedResourcePurgeService {
  constructor(
    private readonly executor: PgExecutor,
    private readonly transaction: TransactionPort,
    private readonly accessControl: AccessControlPort,
    private readonly audit: AuditPort,
    private readonly storage: AttachmentStoragePort,
  ) {}

  async purgeEntity(actorUserId: string, entityId: string): Promise<void> {
    const storageKeys = await this.transaction.runInTransaction(async () => {
      const entityResult = await this.executor.query<{ parent_node_id: string; entity_type_id: string; name: string }>(
        'SELECT parent_node_id, entity_type_id, name FROM entities WHERE id = $1 AND deleted_at IS NOT NULL', [entityId],
      );
      const entity = entityResult.rows[0];
      if (!entity) throw new Error('Deleted entity not found.');
      await this.accessControl.assertHasPermission(actorUserId, 'entity.purge', entity.parent_node_id);

      const attachments = await this.executor.query<AttachmentRow>(
        'SELECT storage_key FROM resource_attachments WHERE resource_type = $1 AND resource_id = $2', ['entity', entityId],
      );
      await this.executor.query('DELETE FROM resource_attachments WHERE resource_type = $1 AND resource_id = $2', ['entity', entityId]);
      await this.executor.query('DELETE FROM resource_field_ciphertexts WHERE resource_type = $1 AND resource_id = $2', ['entity', entityId]);
      await this.executor.query('DELETE FROM entities WHERE id = $1 AND deleted_at IS NOT NULL', [entityId]);
      await this.audit.record(actorUserId, 'entity.purge', 'entity', entityId, entity.parent_node_id, { name: entity.name }, null);
      return attachments.rows.map((row) => row.storage_key);
    });

    for (const storageKey of storageKeys) {
      try {
        await this.storage.delete(storageKey);
      } catch (error) {
        console.error('[DeletedResourcePurge] Attachment cleanup failed', { storageKey, error });
      }
    }
  }

  async purgeNodeSubtree(actorUserId: string, nodeId: string): Promise<void> {
    const storageKeys = await this.transaction.runInTransaction(async () => {
      const root = await this.executor.query<{ parent_id: string | null; name: string; deletion_batch_id: string | null }>(
        'SELECT parent_id, name, deletion_batch_id FROM nodes WHERE id = $1 AND deleted_at IS NOT NULL', [nodeId],
      );
      const node = root.rows[0];
      if (!node || !node.deletion_batch_id) throw new Error('Deleted node subtree not found.');
      await this.accessControl.assertHasPermission(actorUserId, 'node.purge', nodeId);
      const batchParams = [node.deletion_batch_id];
      const attachments = await this.executor.query<AttachmentRow>(`
        SELECT storage_key FROM resource_attachments
        WHERE (resource_type = 'node' AND resource_id IN (SELECT id FROM nodes WHERE deletion_batch_id = $1))
           OR (resource_type = 'entity' AND resource_id IN (SELECT id FROM entities WHERE deletion_batch_id = $1))`, batchParams);
      await this.executor.query(`DELETE FROM resource_attachments WHERE (resource_type = 'node' AND resource_id IN (SELECT id FROM nodes WHERE deletion_batch_id = $1)) OR (resource_type = 'entity' AND resource_id IN (SELECT id FROM entities WHERE deletion_batch_id = $1))`, batchParams);
      await this.executor.query(`DELETE FROM resource_field_ciphertexts WHERE (resource_type = 'node' AND resource_id IN (SELECT id FROM nodes WHERE deletion_batch_id = $1)) OR (resource_type = 'entity' AND resource_id IN (SELECT id FROM entities WHERE deletion_batch_id = $1))`, batchParams);
      await this.executor.query('DELETE FROM entities WHERE deleted_at IS NOT NULL AND deletion_batch_id = $1', batchParams);
      await this.executor.query('DELETE FROM nodes WHERE deleted_at IS NOT NULL AND deletion_batch_id = $1', batchParams);
      await this.audit.record(actorUserId, 'node.purge', 'node', nodeId, node.parent_id, { name: node.name, deletionBatchId: node.deletion_batch_id }, null);
      return attachments.rows.map((row) => row.storage_key);
    });
    for (const storageKey of storageKeys) {
      try { await this.storage.delete(storageKey); } catch (error) { console.error('[DeletedResourcePurge] Attachment cleanup failed', { storageKey, error }); }
    }
  }
}
