/** Guards ancestor node lists against stale entries after a local subtree delete. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../actions/nodeActions', () => ({
  createNodeAction: vi.fn(),
  updateNodeAction: vi.fn(),
  moveNodeAction: vi.fn(),
  deleteNodeAction: vi.fn(),
  getNodeByIdAction: vi.fn(),
  listChildrenAction: vi.fn(),
}));

import * as nodeActions from '../actions/nodeActions';
import { GlobalCacheClient } from './GlobalCacheClient';

describe('GlobalCacheClient node deletion invalidation', () => {
  const parentNodeId = 'parent-node';
  const deletedNode = {
    id: 'deleted-node',
    parentId: parentNodeId,
    name: 'Nodo da eliminare',
    rowVersion: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes a deleted child from an already loaded ancestor list', async () => {
    let deleted = false;
    vi.mocked(nodeActions.listChildrenAction).mockImplementation(async (parentId) => (
      parentId === parentNodeId && !deleted ? [deletedNode] : []
    ) as never);
    vi.mocked(nodeActions.deleteNodeAction).mockImplementation(async () => {
      deleted = true;
      return { success: true, data: { parentNodeId } } as never;
    });

    const cache = new GlobalCacheClient();
    const observedLists: string[][] = [];
    const unsubscribe = cache.nodes.subscribeChildren(parentNodeId, (nodes) => {
      observedLists.push(nodes.map((node) => node.id));
    });

    await vi.waitFor(() => expect(observedLists.at(-1)).toEqual([deletedNode.id]));
    await cache.deleteNode(deletedNode.id, deletedNode.rowVersion);
    await vi.waitFor(() => expect(observedLists.at(-1)).toEqual([]));

    expect(observedLists).toContainEqual([deletedNode.id]);
    expect(observedLists.at(-1)).toEqual([]);
    unsubscribe();
  });
});
