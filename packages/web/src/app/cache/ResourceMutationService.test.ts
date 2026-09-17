import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../actions/nodeActions', () => ({
  createNodeAction: vi.fn(), updateNodeAction: vi.fn(), moveNodeAction: vi.fn(), deleteNodeAction: vi.fn(),
}));
vi.mock('../actions/entityActions', () => ({
  createEntityAction: vi.fn(), updateEntityAction: vi.fn(), deleteEntityAction: vi.fn(),
}));

import * as nodeActions from '../actions/nodeActions';
import { ResourceMutationCoordinator } from './ResourceMutationCoordinator';
import { ResourceMutationService, type ResourceMutationServicePorts } from './ResourceMutationService';

function createPorts(epoch = 1): ResourceMutationServicePorts & { setEpoch(next: number): void } {
  let currentEpoch = epoch;
  return {
    getCacheEpoch: () => currentEpoch,
    setEpoch: (next) => { currentEpoch = next; },
    nodes: { inject: vi.fn(), invalidate: vi.fn(), fetchIfMissing: vi.fn() } as never,
    getEntityCache: vi.fn(() => ({ inject: vi.fn(), invalidate: vi.fn(), fetchIfMissing: vi.fn() } as never)),
    applyResourceCacheChange: vi.fn(),
    invalidateAdmin: vi.fn(),
    handleError: vi.fn(),
  };
}

describe('ResourceMutationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits a successful node creation into the canonical cache and dependent admin views', async () => {
    vi.mocked(nodeActions.createNodeAction).mockResolvedValue({
      success: true,
      data: { id: 'node-1', name: 'Project', rowVersion: 1 },
    } as never);
    const ports = createPorts();
    const service = new ResourceMutationService(new ResourceMutationCoordinator(), ports);

    await expect(service.createNode({ parentNodeId: null, nodeTypeKey: 'project', name: 'Project' }))
      .resolves.toMatchObject({ id: 'node-1' });

    expect(ports.nodes.inject).toHaveBeenCalledWith('node-1', expect.objectContaining({ name: 'Project' }), false, 'mutation:createNode');
    expect(ports.applyResourceCacheChange).toHaveBeenCalledWith({ resourceType: 'node', resourceId: 'node-1', changeType: 'created' });
    expect(ports.invalidateAdmin).toHaveBeenCalledWith(['admin-nodes-page', 'admin-entities-page']);
  });

  it('does not commit a response that belongs to a cache generation invalidated during the request', async () => {
    const ports = createPorts();
    vi.mocked(nodeActions.createNodeAction).mockImplementation(async () => {
      ports.setEpoch(2);
      return { success: true, data: { id: 'node-1', name: 'Project', rowVersion: 1 } } as never;
    });
    const service = new ResourceMutationService(new ResourceMutationCoordinator(), ports);

    await service.createNode({ parentNodeId: null, nodeTypeKey: 'project', name: 'Project' });

    expect(ports.nodes.inject).not.toHaveBeenCalled();
    expect(ports.applyResourceCacheChange).not.toHaveBeenCalled();
  });

  it('routes a rejected server mutation through the configured error policy before rethrowing it', async () => {
    vi.mocked(nodeActions.createNodeAction).mockResolvedValue({
      success: false,
      error: { code: 'AUTH_UNAUTHORIZED', message: 'Authentication credentials are required' },
    } as never);
    const ports = createPorts();
    const service = new ResourceMutationService(new ResourceMutationCoordinator(), ports);

    await expect(service.createNode({ parentNodeId: null, nodeTypeKey: 'project', name: 'Project' }))
      .rejects.toThrow('Authentication credentials are required');

    expect(ports.handleError).toHaveBeenCalledOnce();
  });
});
