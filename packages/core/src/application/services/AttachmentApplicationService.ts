/** Owns authorized attachment lifecycle, aggregate concurrency and durable mutation effects. */
import { AppError } from '../../domain/errors/AppError.js';
import { defaultAttachmentSecurityPolicy, detectAttachmentType } from '../dto/AttachmentSecurityPolicy.js';
import type { AttachmentRecord, AttachmentRepository } from '../ports/AttachmentRepository.js';
import type { AttachmentStoragePort } from '../ports/AttachmentStoragePort.js';
import type { AttachmentScannerPort } from '../ports/AttachmentScannerPort.js';
import type { AttachmentRateLimitPort } from '../ports/AttachmentRateLimitPort.js';
import type { ResourceSecurityPolicyResolver } from '../ports/ResourceSecurityPolicyResolver.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { NodeRepository } from '../ports/NodeRepository.js';
import type { EntityRepository } from '../ports/EntityRepository.js';
import type { NodeTypeRepository } from '../ports/NodeTypeRepository.js';
import type { EntityTypeRepository } from '../ports/EntityTypeRepository.js';
import type { TypeDefinitionReader } from '../ports/TypeDefinitionReader.js';
import type { AuditPort } from '../ports/AuditPort.js';
import type { IdGeneratorPort } from '../ports/IdGeneratorPort.js';
import type { NodeApplicationService } from './NodeApplicationService.js';
import type { EntityApplicationService } from './EntityApplicationService.js';
import type { AttachmentCleanupService } from './AttachmentCleanupService.js';

export interface AttachmentTarget {
  resourceType: 'node' | 'entity';
  resourceId: string;
  fieldKey: string;
  kind: 'file' | 'image';
}
export interface AttachmentMutationIdentity {
  actorUserId: string;
  actorSessionId: string;
  expectedRowVersion: number;
  mutationId?: string | undefined;
}
export interface AttachmentChange extends AttachmentTarget {
  actorUserId: string;
  actorSessionId: string;
  scopeNodeId: string;
  rowVersion: number;
  entityTypeId?: string;
  mutationId?: string | undefined;
}
export interface AttachmentApplicationDependencies {
  attachments: AttachmentRepository;
  storage: AttachmentStoragePort;
  scanner: AttachmentScannerPort | undefined;
  rateLimiter: AttachmentRateLimitPort;
  security: ResourceSecurityPolicyResolver;
  transactions: TransactionPort;
  access: AccessControlPort;
  nodes: NodeRepository;
  entities: EntityRepository;
  nodeTypes: NodeTypeRepository;
  entityTypes: EntityTypeRepository;
  types: TypeDefinitionReader;
  nodeMutations: Pick<NodeApplicationService, 'updateNode'>;
  entityMutations: Pick<EntityApplicationService, 'updateEntity'>;
  audit: AuditPort;
  ids: IdGeneratorPort;
  cleanup: AttachmentCleanupService;
  /** Persists the resource invalidation in the caller's transaction; never delivers it. */
  enqueueChange(change: AttachmentChange): Promise<void>;
}

export class AttachmentApplicationService {
  constructor(private readonly ports: AttachmentApplicationDependencies) {}

  async access(actorUserId: string, target: Pick<AttachmentTarget, 'resourceType' | 'resourceId'>, mode: 'read' | 'write' = 'write') {
    const node = target.resourceType === 'node' ? await this.ports.nodes.findById(target.resourceId) : null;
    const entity = target.resourceType === 'entity' ? await this.ports.entities.findById(target.resourceId) : null;
    if ((!node && !entity) || node?.deletedAt || entity?.deletedAt) throw new AppError('RESOURCE_NOT_FOUND', 'Resource not found');
    const scopeNodeId = node?.id ?? entity!.parentNodeId;
    await this.ports.access.assertHasPermission(actorUserId, `${target.resourceType}.${mode === 'read' ? 'read' : 'edit'}`, scopeNodeId);
    const parent = node ?? await this.ports.nodes.findById(scopeNodeId);
    if (!parent || parent.deletedAt) throw new AppError('RESOURCE_NOT_FOUND', 'Resource not found');
    return { scopeNodeId, resourceTypeId: node?.nodeTypeId ?? entity!.entityTypeId, rowVersion: node?.rowVersion ?? entity!.rowVersion };
  }

  async assertField(target: AttachmentTarget, typeId: string): Promise<void> {
    const type = target.resourceType === 'node' ? await this.ports.nodeTypes.findById(typeId) : await this.ports.entityTypes.findById(typeId);
    const definition = type ? await this.ports.types.readDefinition(target.resourceType, type.typeKey) : null;
    if (!definition?.fields.some((field) => field.fieldKey === target.fieldKey && field.dataType === target.kind)) {
      throw new AppError('INVALID_ATTACHMENT_FIELD', 'Invalid attachment field');
    }
  }

  async list(actorUserId: string, target: AttachmentTarget) {
    return this.ports.transactions.runInTransaction(async () => {
      const access = await this.access(actorUserId, target, 'read');
      await this.assertField(target, access.resourceTypeId);
      const items = await this.ports.attachments.list(target.resourceType, target.resourceId, target.fieldKey);
      return items.map((item) => ({ ...item, rowVersion: access.rowVersion }));
    });
  }

  async download(actorUserId: string, id: string) {
    const attachment = await this.find(id);
    const access = await this.access(actorUserId, attachment, 'read');
    await this.assertField(attachment, access.resourceTypeId);
    const content = await this.ports.storage.get(attachment.storageKey);
    if (!content) throw new AppError('ATTACHMENT_CONTENT_NOT_FOUND', 'Attachment content not found');
    await this.ports.audit.record(actorUserId, 'attachment.download', 'attachment', id, access.scopeNodeId, null, {
      resourceType: attachment.resourceType, resourceId: attachment.resourceId, fileName: attachment.fileName,
    });
    return { attachment, content };
  }

  async upload(command: AttachmentMutationIdentity & AttachmentTarget & { fileName: string; mimeType: string; content: Uint8Array }) {
    this.validateIdentity(command);
    if (command.content.byteLength > defaultAttachmentSecurityPolicy.maxFileSizeBytes) throw new AppError('ATTACHMENT_TOO_LARGE', 'Attachment too large');
    const access = await this.access(command.actorUserId, command);
    await this.assertField(command, access.resourceTypeId);
    if (!await this.ports.rateLimiter.consume(command.actorUserId, defaultAttachmentSecurityPolicy.maxUploadsPerHour)) throw new AppError('ATTACHMENT_RATE_LIMITED', 'Upload rate limited');
    const detected = detectAttachmentType(command.fileName, command.mimeType, command.content, command.kind);
    if (!detected) throw new AppError('ATTACHMENT_CONTENT_TYPE_MISMATCH', 'Invalid attachment content');
    const policy = await this.ports.security.resolve(command.resourceType, command.resourceId);
    if (policy.antivirusEnabled) {
      if (!this.ports.scanner) throw new AppError('ATTACHMENT_SCANNER_UNAVAILABLE', 'Attachment scanner unavailable');
      if (await this.ports.scanner.scan(command.content, { fileName: command.fileName, mimeType: detected.mimeType }) === 'infected') throw new AppError('ATTACHMENT_INFECTED', 'Attachment infected');
    }
    const id = this.ports.ids.generate();
    const fileName = command.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-255) || 'upload';
    const storageKey = `${command.resourceType}/${command.resourceId}/${id}-${fileName}`;
    await this.ports.cleanup.scheduleUploadStaging(storageKey);
    const stored = await this.ports.storage.put(storageKey, command.content, { encrypt: policy.encryptionEnabled });
    try {
      return await this.ports.transactions.runInTransaction(async () => {
        await this.ports.attachments.lockMutationPolicy();
        const current = await this.access(command.actorUserId, command);
        await this.assertField(command, current.resourceTypeId);
        const currentPolicy = await this.ports.security.resolve(command.resourceType, command.resourceId);
        if (currentPolicy.encryptionEnabled !== policy.encryptionEnabled || currentPolicy.antivirusEnabled !== policy.antivirusEnabled) throw new AppError('ATTACHMENT_POLICY_CHANGED', 'Attachment policy changed; retry upload');
        const resource = await this.advanceAggregate(command);
        const rowVersion = resource.rowVersion;
        const record: AttachmentRecord = { id, resourceType: command.resourceType, resourceId: command.resourceId, fieldKey: command.fieldKey, kind: command.kind, fileName, mimeType: detected.mimeType, sizeBytes: stored.sizeBytes, storageKey, checksum: stored.checksum, createdBy: command.actorUserId };
        if (!await this.ports.attachments.createWithinQuota(record, defaultAttachmentSecurityPolicy.maxResourceBytes)) throw new AppError('ATTACHMENT_QUOTA_EXCEEDED', 'Attachment quota exceeded');
        await this.ports.audit.record(command.actorUserId, 'attachment.upload', 'attachment', id, current.scopeNodeId, null, {
          resourceType: record.resourceType, resourceId: record.resourceId, fileName, mimeType: record.mimeType, sizeBytes: record.sizeBytes, checksum: record.checksum,
        });
        await this.ports.cleanup.cancel(storageKey);
        await this.ports.enqueueChange({ ...command, scopeNodeId: current.scopeNodeId, rowVersion, ...('entityTypeId' in resource ? { entityTypeId: resource.entityTypeId } : {}) });
        return { ...record, rowVersion, resource };
      });
    } catch (error) {
      // Staging remains durable if immediate cleanup is unavailable.
      try { await this.ports.storage.delete(storageKey); await this.ports.cleanup.cancel(storageKey); }
      catch { /* The cleanup worker retries the persisted staging record. */ }
      throw error;
    }
  }

  async remove(command: AttachmentMutationIdentity & { attachmentId: string }) {
    this.validateIdentity(command);
    return this.ports.transactions.runInTransaction(async () => {
      const attachment = await this.find(command.attachmentId);
      await this.ports.attachments.lockMutationPolicy();
      const access = await this.access(command.actorUserId, attachment);
      await this.assertField(attachment, access.resourceTypeId);
      const resource = await this.advanceAggregate({ ...attachment, ...command });
      const rowVersion = resource.rowVersion;
      await this.ports.attachments.delete(attachment.id);
      await this.ports.audit.record(command.actorUserId, 'attachment.delete', 'attachment', attachment.id, access.scopeNodeId, {
        resourceType: attachment.resourceType, resourceId: attachment.resourceId, fileName: attachment.fileName,
      }, null);
      await this.ports.cleanup.scheduleDeletion(attachment.storageKey);
      await this.ports.enqueueChange({ ...attachment, actorUserId: command.actorUserId, actorSessionId: command.actorSessionId, mutationId: command.mutationId, scopeNodeId: access.scopeNodeId, rowVersion, ...('entityTypeId' in resource ? { entityTypeId: resource.entityTypeId } : {}) });
      return { deleted: true, rowVersion, resource };
    });
  }

  private async find(id: string) {
    const attachment = await this.ports.attachments.getById(id);
    if (!attachment) throw new AppError('ATTACHMENT_NOT_FOUND', 'Attachment not found');
    return attachment;
  }

  private validateIdentity(command: AttachmentMutationIdentity): void {
    if (!command.actorSessionId || !command.actorUserId || !Number.isSafeInteger(command.expectedRowVersion) || command.expectedRowVersion < 1) throw new AppError('VALIDATION_FAILED', 'Session and expected version are required');
  }

  private async advanceAggregate(command: AttachmentMutationIdentity & Pick<AttachmentTarget, 'resourceType' | 'resourceId'>) {
    // Existing aggregate services remain the sole owners of edit ACL, lock,
    // conditional version writes, revisions and record.updated workflow events.
    const identity = { actorUserId: command.actorUserId, actorSessionId: command.actorSessionId, expectedRowVersion: command.expectedRowVersion };
    const resource = command.resourceType === 'node'
      ? await this.ports.nodeMutations.updateNode({ ...identity, nodeId: command.resourceId })
      : await this.ports.entityMutations.updateEntity({ ...identity, entityId: command.resourceId });
    return resource;
  }
}
