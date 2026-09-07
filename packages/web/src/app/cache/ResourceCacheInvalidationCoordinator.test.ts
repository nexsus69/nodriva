/** Verifies one invalidation contract for local mutations and realtime events. */
import { describe, expect, it, vi } from 'vitest';
import {
  ResourceCacheInvalidationCoordinator,
  type ResourceCacheInvalidationSink,
} from './ResourceCacheInvalidationCoordinator';

function createSink(): ResourceCacheInvalidationSink & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    removeNode: vi.fn((id) => calls.push(`remove-node:${id}`)),
    removeEntity: vi.fn((typeId, id) => calls.push(`remove-entity:${typeId}:${id}`)),
    invalidateNodeChildren: vi.fn(() => calls.push('node-children')),
    invalidateNodeHierarchy: vi.fn(() => calls.push('node-hierarchy')),
    invalidateEntityMembership: vi.fn(() => calls.push('entity-membership')),
    invalidateNodeReference: vi.fn((id) => calls.push(`node-reference:${id}`)),
    invalidateEntityReference: vi.fn((typeId, id) => calls.push(`entity-reference:${typeId}:${id}`)),
  };
}

describe('ResourceCacheInvalidationCoordinator', () => {
  it('applies the same effects for a local and a remote node deletion', () => {
    const localSink = createSink();
    const remoteSink = createSink();
    const local = new ResourceCacheInvalidationCoordinator(localSink);
    const remote = new ResourceCacheInvalidationCoordinator(remoteSink);
    const change = {
      resourceType: 'node' as const,
      resourceId: 'node-1',
      changeType: 'deleted' as const,
      affectedResourceIds: ['node-1', 'entity-1'],
    };

    local.apply(change);
    remote.apply(change);

    expect(localSink.calls).toEqual(remoteSink.calls);
    expect(localSink.calls).toEqual([
      'remove-node:node-1',
      'node-reference:node-1',
      'node-children',
      'node-hierarchy',
      'entity-membership',
    ]);
  });

  it('invalidates entity membership for updates and removes deleted entity references', () => {
    const sink = createSink();
    const coordinator = new ResourceCacheInvalidationCoordinator(sink);

    coordinator.apply({ resourceType: 'entity', resourceId: 'entity-1', entityTypeId: 'task', changeType: 'updated' });
    coordinator.apply({ resourceType: 'entity', resourceId: 'entity-2', entityTypeId: 'task', changeType: 'deleted' });

    expect(sink.invalidateEntityMembership).toHaveBeenCalledTimes(2);
    expect(sink.removeEntity).toHaveBeenCalledWith('task', 'entity-2');
    expect(sink.invalidateEntityReference).toHaveBeenCalledWith('task', 'entity-2');
  });

  it('invalidates entity membership for a local node deletion without descendants', () => {
    const sink = createSink();
    const coordinator = new ResourceCacheInvalidationCoordinator(sink);

    coordinator.apply({ resourceType: 'node', resourceId: 'node-1', changeType: 'deleted' });

    expect(sink.invalidateEntityMembership).toHaveBeenCalledOnce();
  });
});
