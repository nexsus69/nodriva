import type { AccessControlPort, AttachmentStoragePort, AuditPort, ResourcePurgeRepository, TransactionPort } from '@dashboard/core';

export class DeletedResourcePurgeService {
  constructor(
    private readonly repository: ResourcePurgeRepository,
    private readonly transaction: TransactionPort,
    private readonly accessControl: AccessControlPort,
    private readonly audit: AuditPort,
    private readonly storage: AttachmentStoragePort,
  ) {}

  async purgeEntity(actorUserId: string, entityId: string): Promise<void> {
    const storageKeys = await this.transaction.runInTransaction(async () => {
      const context = await this.repository.getEntityPurgeContext(entityId);
      if (!context) throw new Error('Deleted entity not found.');
      const assertPurge = this.accessControl.assertHasPermissionIncludingDeleted?.bind(this.accessControl)
        ?? this.accessControl.assertHasPermission.bind(this.accessControl);
      await assertPurge(actorUserId, 'entity.purge', context.parentNodeId);
      const entity = await this.repository.purgeEntity(entityId);
      await this.audit.record(actorUserId, 'entity.purge', 'entity', entityId, context.parentNodeId, { name: context.name }, null);
      return entity.storageKeys;
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
      const context = await this.repository.getNodePurgeContext(nodeId);
      if (!context) throw new Error('Deleted node subtree not found.');
      const assertPurge = this.accessControl.assertHasPermissionIncludingDeleted?.bind(this.accessControl)
        ?? this.accessControl.assertHasPermission.bind(this.accessControl);
      await assertPurge(actorUserId, 'node.purge', nodeId);
      const node = await this.repository.purgeNodeSubtree(nodeId);
      await this.audit.record(actorUserId, 'node.purge', 'node', nodeId, context.parentNodeId, { name: context.name, deletionBatchId: context.deletionBatchId }, null);
      return node.storageKeys;
    });
    for (const storageKey of storageKeys) {
      try { await this.storage.delete(storageKey); } catch (error) { console.error('[DeletedResourcePurge] Attachment cleanup failed', { storageKey, error }); }
    }
  }
}
