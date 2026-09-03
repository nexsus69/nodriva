/** Verifies restrict semantics and suspension boundaries for resource deletion. */
import { describe, expect, it, vi } from 'vitest';
import { ResourceDeletionPolicyService } from './ResourceDeletionPolicyService.js';

describe('ResourceDeletionPolicyService', () => {
  it('permits internal subtree references and suspends the complete deletion set', async () => {
    const relationships = {
      listActiveIncomingForTargets: vi.fn().mockResolvedValue([{ sourceDomain: 'node', sourceResourceId: 'child' }]),
      lockActiveTargets: vi.fn(),
      suspendActiveOutgoingForSources: vi.fn(),
    };
    const service = new ResourceDeletionPolicyService(relationships as never, {} as never, {} as never, {} as never);
    await service.assertRestrictAndSuspend('actor', [{ domain: 'node', resourceId: 'root' }, { domain: 'node', resourceId: 'child' }], '00000000-0000-0000-0000-000000000001');
    expect(relationships.suspendActiveOutgoingForSources).toHaveBeenCalledOnce();
  });

  it('rejects an external active referencer without suspending anything', async () => {
    const relationships = {
      listActiveIncomingForTargets: vi.fn().mockResolvedValue([{ sourceDomain: 'entity', sourceResourceId: 'outside' }]),
      lockActiveTargets: vi.fn(),
      suspendActiveOutgoingForSources: vi.fn(),
    };
    const nodes = { listActiveReferenceLabels: vi.fn().mockResolvedValue([{ id: 'outside-node', type: 'Folder', name: 'Outside' }]) };
    const entities = { listActiveReferenceLabels: vi.fn().mockResolvedValue([]) };
    const acl = { listReadableResourceIds: vi.fn(async (_actor: string, domain: string) => domain === 'node' ? ['outside-node'] : []) };
    relationships.listActiveIncomingForTargets.mockResolvedValue([{ sourceDomain: 'node', sourceResourceId: 'outside-node' }]);
    const service = new ResourceDeletionPolicyService(relationships as never, nodes as never, entities as never, acl as never);
    await expect(service.assertRestrictAndSuspend('actor', [{ domain: 'node', resourceId: 'root' }], '00000000-0000-0000-0000-000000000001'))
      .rejects.toMatchObject({ code: 'RESOURCE_DELETE_RESTRICTED', details: { totalReferencerCount: 1, referencers: [{ domain: 'node', id: 'outside-node', type: 'Folder', name: 'Outside' }] } });
    expect(relationships.suspendActiveOutgoingForSources).not.toHaveBeenCalled();
  });
});
