/** Purges tombstones and durably schedules their attachment blob cleanup. */
import type { AccessControlPort, AttachmentCleanupService, AuditPort, ResourcePurgeRepository, TransactionPort } from '@dashboard/core';

export class DeletedResourcePurgeService {
  constructor(
    private readonly repository: ResourcePurgeRepository,
    private readonly transaction: TransactionPort,
    private readonly accessControl: AccessControlPort,
    private readonly audit: AuditPort,
    private readonly attachmentCleanup: AttachmentCleanupService,
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
      for (const storageKey of entity.storageKeys) await this.attachmentCleanup.scheduleDeletion(storageKey);
      return entity.storageKeys;
    });
    if (storageKeys.length > 0) void this.attachmentCleanup.drain().catch((error) => {
      console.error('[DeletedResourcePurge] Attachment cleanup drain failed', error);
    });
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
      for (const storageKey of node.storageKeys) await this.attachmentCleanup.scheduleDeletion(storageKey);
      return node.storageKeys;
    });
    if (storageKeys.length > 0) void this.attachmentCleanup.drain().catch((error) => {
      console.error('[DeletedResourcePurge] Attachment cleanup drain failed', error);
    });
  }
}
