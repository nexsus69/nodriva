import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheKernel } from './CacheKernel';
import { KernelNodeCacheClient } from './KernelNodeCacheClient';

const mocks = vi.hoisted(() => ({
  getNodeByIdAction: vi.fn(),
  listChildrenAction: vi.fn(),
}));

vi.mock('../actions/nodeActions', () => ({
  getNodeByIdAction: mocks.getNodeByIdAction,
  listChildrenAction: mocks.listChildrenAction,
}));

const node = (id: string, name: string) => ({
  id,
  parentId: null,
  path: id,
  pathLabel: name,
  depth: 0,
  nodeTypeId: 'workspace',
  name,
  description: '',
  rowVersion: 1,
});

describe('KernelNodeCacheClient', () => {
  let client: KernelNodeCacheClient;
  let kernel: CacheKernel;

  beforeEach(() => {
    vi.clearAllMocks();
    kernel = new CacheKernel();
    client = new KernelNodeCacheClient(kernel, vi.fn());
    mocks.listChildrenAction.mockResolvedValue([node('node-1', 'Project')]);
  });

  it('normalizes child lists and deduplicates concurrent loads', async () => {
    const first = client.listChildren(null);
    const second = client.listChildren(null);

    await expect(first).resolves.toMatchObject([{ id: 'node-1', name: 'Project' }]);
    await expect(second).resolves.toMatchObject([{ id: 'node-1', name: 'Project' }]);
    expect(mocks.listChildrenAction).toHaveBeenCalledTimes(1);
    expect(client.get('node-1')?.name).toBe('Project');
  });

  it('reloads child-list subscribers after invalidation', async () => {
    await client.listChildren(null);
    const received: string[] = [];
    const unsubscribe = client.subscribeChildren(null, (nodes) => {
      received.push(nodes.map((item) => item.name).join(','));
    });

    mocks.listChildrenAction.mockResolvedValue([node('node-2', 'Analytics')]);
    client.invalidateChildren();
    await vi.waitFor(() => expect(received.at(-1)).toBe('Analytics'));

    expect(mocks.listChildrenAction).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('deduplicates concurrent record hydration', async () => {
    mocks.getNodeByIdAction.mockResolvedValue(node('node-1', 'Project'));

    const first = client.fetchIfMissing('node-1', true);
    const second = client.fetchIfMissing('node-1', true);

    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ id: 'node-1' });
    expect(mocks.getNodeByIdAction).toHaveBeenCalledTimes(1);
  });

  it('does not inject a response started before a session purge', async () => {
    let resolveRequest: ((value: ReturnType<typeof node>) => void) | undefined;
    mocks.getNodeByIdAction.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const pending = client.fetchIfMissing('private-node', true);
    kernel.purge();
    resolveRequest!(node('private-node', 'Private'));

    await expect(pending).resolves.toBeNull();
    expect(client.get('private-node')).toBeNull();
  });
});
