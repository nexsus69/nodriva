import { describe, expect, it, vi } from 'vitest';
import { RealtimeScopeResolverPostgres } from './RealtimeScopeResolverPostgres.js';
import { NodeRepository } from '../../application/ports/NodeRepository.js';
import { RealtimeDataChangedEvent } from '../../application/ports/RealtimeEventBus.js';

const baseEvent: RealtimeDataChangedEvent = {
  eventId: 'event-1',
  occurredAt: '2026-08-02T10:00:00.000Z',
  resourceType: 'entity',
  resourceId: 'entity-1',
  changeType: 'updated',
  actorUserId: 'user-1',
  parentNodeId: 'node-leaf',
};

function createRepository(
  listAncestorIds: NodeRepository['listAncestorIds'],
  listAncestorIdsForNodes?: NonNullable<NodeRepository['listAncestorIdsForNodes']>,
): NodeRepository {
  return { listAncestorIds, listAncestorIdsForNodes } as unknown as NodeRepository;
}

describe('RealtimeScopeResolverPostgres', () => {
  it('resolves the current node and all ancestors', async () => {
    const listAncestorIds = vi.fn().mockResolvedValue(['node-leaf', 'node-parent', 'node-root']);
    const resolver = new RealtimeScopeResolverPostgres(createRepository(listAncestorIds));

    await expect(resolver.resolveScopes(baseEvent)).resolves.toEqual([
      'node-leaf',
      'node-parent',
      'node-root',
    ]);
    expect(listAncestorIds).toHaveBeenCalledWith('node-leaf');
  });

  it('deduplicates scopes when a move touches overlapping hierarchies', async () => {
    const listAncestorIds = vi.fn()
      .mockResolvedValueOnce(['new-parent', 'shared-root'])
      .mockResolvedValueOnce(['old-parent', 'shared-root']);
    const resolver = new RealtimeScopeResolverPostgres(createRepository(listAncestorIds));

    await expect(resolver.resolveScopes({
      ...baseEvent,
      changeType: 'moved',
      parentNodeId: 'new-parent',
      previousParentNodeId: 'old-parent',
    })).resolves.toEqual(['new-parent', 'shared-root', 'old-parent']);
  });

  it('resolves moved-node ancestors with one batch lookup when supported', async () => {
    const listAncestorIds = vi.fn();
    const listAncestorIdsForNodes = vi.fn().mockResolvedValue(new Map([
      ['new-parent', ['new-parent', 'shared-root']],
      ['old-parent', ['old-parent', 'shared-root']],
    ]));
    const resolver = new RealtimeScopeResolverPostgres(createRepository(listAncestorIds, listAncestorIdsForNodes));

    await expect(resolver.resolveScopes({
      ...baseEvent,
      changeType: 'moved',
      parentNodeId: 'new-parent',
      previousParentNodeId: 'old-parent',
    })).resolves.toEqual(['new-parent', 'shared-root', 'old-parent']);

    expect(listAncestorIdsForNodes).toHaveBeenCalledWith(['new-parent', 'old-parent']);
    expect(listAncestorIds).not.toHaveBeenCalled();
  });

  it('uses the direct node as fallback when the hierarchy lookup fails', async () => {
    const listAncestorIds = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const resolver = new RealtimeScopeResolverPostgres(createRepository(listAncestorIds));

    await expect(resolver.resolveScopes(baseEvent)).resolves.toEqual(['node-leaf']);
  });

  it('uses the direct node as fallback when no active ancestor is returned', async () => {
    const listAncestorIds = vi.fn().mockResolvedValue([]);
    const resolver = new RealtimeScopeResolverPostgres(createRepository(listAncestorIds));

    await expect(resolver.resolveScopes(baseEvent)).resolves.toEqual(['node-leaf']);
  });

  it('fails clearly when an event has no resolvable node scope', async () => {
    const listAncestorIds = vi.fn();
    const resolver = new RealtimeScopeResolverPostgres(createRepository(listAncestorIds));

    await expect(resolver.resolveScopes({
      ...baseEvent,
      parentNodeId: null,
    })).rejects.toThrow('missing node scope');
    expect(listAncestorIds).not.toHaveBeenCalled();
  });
});
