/** Reproduces attachment concurrency, policy changes and rollback of durable effects. */
import { describe, expect, it, vi } from 'vitest';
import { AttachmentApplicationService, type AttachmentApplicationDependencies } from './AttachmentApplicationService.js';
import { AppError } from '../../domain/errors/AppError.js';

const command = { actorUserId: 'actor', actorSessionId: 'session', expectedRowVersion: 1, resourceType: 'node' as const, resourceId: 'node', fieldKey: 'files', kind: 'file' as const, fileName: 'report.txt', mimeType: 'text/plain', content: new TextEncoder().encode('report') };

function fixture() {
  let state = { version: 1, metadata: false, audit: false, event: false };
  const record = { ...command, id: 'attachment', storageKey: 'blob', sizeBytes: 6, checksum: 'checksum', createdBy: 'actor' };
  const ports = {
    transactions: { runInTransaction: async (work: () => Promise<unknown>) => { const before = { ...state }; try { return await work(); } catch (error) { state = before; throw error; } } },
    nodes: { findById: vi.fn(async () => ({ id: 'node', nodeTypeId: 'type', rowVersion: state.version })) },
    entities: { findById: vi.fn() },
    nodeTypes: { findById: vi.fn(async () => ({ typeKey: 'type' })) }, entityTypes: { findById: vi.fn() },
    types: { readDefinition: vi.fn(async () => ({ fields: [{ fieldKey: 'files', dataType: 'file' }] })) },
    access: { assertHasPermission: vi.fn(async () => undefined) },
    security: { resolve: vi.fn(async () => ({ antivirusEnabled: false, encryptionEnabled: false })) },
    nodeMutations: { updateNode: vi.fn(async (input: { expectedRowVersion: number; actorSessionId: string }) => {
      if (input.actorSessionId !== 'session') throw new AppError('LOCK_CONFLICT', 'Other session');
      if (input.expectedRowVersion !== state.version) throw new AppError('ROW_VERSION_MISMATCH', 'Stale');
      return { id: 'node', rowVersion: ++state.version };
    }) }, entityMutations: { updateEntity: vi.fn() },
    rateLimiter: { consume: vi.fn(async () => true) }, scanner: undefined,
    attachments: {
      lockMutationPolicy: vi.fn(async () => undefined),
      createWithinQuota: vi.fn(async () => { state.metadata = true; return true; }),
      getById: vi.fn(async () => state.metadata ? record : null),
      delete: vi.fn(async () => { state.metadata = false; }),
    },
    storage: { put: vi.fn(async () => ({ sizeBytes: 6, checksum: 'checksum' })), delete: vi.fn(async () => undefined) },
    cleanup: { scheduleUploadStaging: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined), scheduleDeletion: vi.fn(async () => undefined) },
    audit: { record: vi.fn(async () => { state.audit = true; }) },
    ids: { generate: () => 'attachment' },
    enqueueChange: vi.fn(async () => { state.event = true; }),
  };
  return { service: new AttachmentApplicationService(ports as unknown as AttachmentApplicationDependencies), ports, state: () => state };
}

describe('AttachmentApplicationService', () => {
  it('includes the entity namespace and mutation correlation in durable attachment events', async () => {
    const { service, ports } = fixture();
    ports.entities.findById.mockResolvedValue({ id: 'entity', parentNodeId: 'node', entityTypeId: 'entity-type', rowVersion: 1 });
    ports.entityTypes.findById.mockResolvedValue({ typeKey: 'entity-type' });
    ports.entityMutations.updateEntity.mockResolvedValue({ id: 'entity', entityTypeId: 'entity-type', rowVersion: 2 });
    await service.upload({ ...command, resourceType: 'entity', resourceId: 'entity', mutationId: 'mutation' });
    expect(ports.enqueueChange).toHaveBeenCalledWith(expect.objectContaining({ entityTypeId: 'entity-type', mutationId: 'mutation', rowVersion: 2, scopeNodeId: 'node' }));
  });
  it('advances the aggregate through its existing policy owner and commits metadata, audit and outbox', async () => {
    const { service, ports, state } = fixture();
    await expect(service.upload(command)).resolves.toMatchObject({ rowVersion: 2 });
    expect(ports.nodeMutations.updateNode).toHaveBeenCalledWith({ actorUserId: 'actor', actorSessionId: 'session', nodeId: 'node', expectedRowVersion: 1 });
    expect(state()).toEqual({ version: 2, metadata: true, audit: true, event: true });
    expect(ports.attachments.lockMutationPolicy).toHaveBeenCalledOnce();
    expect(ports.enqueueChange).toHaveBeenCalledWith(expect.objectContaining({ rowVersion: 2, actorSessionId: 'session' }));
    await expect(service.remove({ ...command, attachmentId: 'attachment', expectedRowVersion: 2 })).resolves.toMatchObject({ deleted: true, rowVersion: 3 });
    expect(ports.cleanup.scheduleDeletion).toHaveBeenCalledWith('blob');
  });

  it.each(['LOCK_CONFLICT', 'ROW_VERSION_MISMATCH'])('rejects %s without persisting an attachment', async (code) => {
    const { service, state, ports } = fixture();
    await expect(service.upload({ ...command, ...(code === 'LOCK_CONFLICT' ? { actorSessionId: 'other-session' } : { expectedRowVersion: 9 }) })).rejects.toMatchObject({ code });
    expect(state()).toEqual({ version: 1, metadata: false, audit: false, event: false });
    expect(ports.storage.delete).toHaveBeenCalledOnce();
  });

  it.each(['audit', 'outbox', 'quota'])('rolls back aggregate and attachment when %s fails', async (failure) => {
    const { service, state, ports } = fixture();
    if (failure === 'audit') ports.audit.record.mockRejectedValueOnce(new Error('audit unavailable'));
    if (failure === 'outbox') ports.enqueueChange.mockRejectedValueOnce(new Error('outbox unavailable'));
    if (failure === 'quota') ports.attachments.createWithinQuota.mockResolvedValueOnce(false);
    await expect(service.upload(command)).rejects.toThrow();
    expect(state()).toEqual({ version: 1, metadata: false, audit: false, event: false });
    expect(ports.cleanup.cancel).toHaveBeenCalled();
  });

  it('rejects a policy changed after staging and reads the field again before commit', async () => {
    const { service, ports, state } = fixture();
    ports.security.resolve.mockResolvedValueOnce({ encryptionEnabled: false, antivirusEnabled: false }).mockResolvedValue({ encryptionEnabled: true, antivirusEnabled: false });
    await expect(service.upload(command)).rejects.toMatchObject({ code: 'ATTACHMENT_POLICY_CHANGED' });
    expect(ports.types.readDefinition).toHaveBeenCalledTimes(2);
    expect(state().version).toBe(1);
  });

  it('rejects revoked access at commit and retains cleanup work after storage cleanup failure', async () => {
    const { service, ports, state } = fixture();
    ports.access.assertHasPermission.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new AppError('ACCESS_FORBIDDEN', 'revoked'));
    ports.storage.delete.mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(service.upload(command)).rejects.toMatchObject({ code: 'ACCESS_FORBIDDEN' });
    expect(state().version).toBe(1);
    expect(ports.cleanup.cancel).not.toHaveBeenCalled();
  });

  it('requires a version and session before staging any content', async () => {
    const { service, ports } = fixture();
    await expect(service.upload({ ...command, expectedRowVersion: 0 })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(service.upload({ ...command, actorSessionId: '' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(ports.storage.put).not.toHaveBeenCalled();
  });
});
