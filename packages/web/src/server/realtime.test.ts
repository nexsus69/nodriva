import { describe, expect, it, vi } from 'vitest';
import { buildRealtimeEvent } from './realtime';

describe('buildRealtimeEvent', () => {
  it('does not resolve UUID scopes for metadata events', async () => {
    const resolveScopes = vi.fn(async () => ['unexpected-scope']);

    const event = await buildRealtimeEvent({
      resourceType: 'node',
      resourceId: 'analytics_project',
      changeType: 'updated',
      actorUserId: 'user-1',
      metadataKind: 'node',
    }, resolveScopes);

    expect(resolveScopes).not.toHaveBeenCalled();
    expect(event.scopeNodeIds).toEqual([]);
    expect(event.directScopeNodeIds).toEqual([]);
  });

  it('resolves scopes for regular resource events', async () => {
    const resolveScopes = vi.fn(async () => ['node-1']);

    const event = await buildRealtimeEvent({
      resourceType: 'entity',
      resourceId: 'entity-1',
      changeType: 'updated',
      actorUserId: 'user-1',
    }, resolveScopes);

    expect(resolveScopes).toHaveBeenCalledOnce();
    expect(event.scopeNodeIds).toEqual(['node-1']);
  });

  it('does not resolve hierarchy scopes for global administrative events', async () => {
    const resolveScopes = vi.fn(async () => ['unexpected-scope']);
    const event = await buildRealtimeEvent({
      resourceType: 'audit',
      resourceId: 'entity:abc',
      changeType: 'created',
      actorUserId: 'user-1',
    }, resolveScopes);

    expect(resolveScopes).not.toHaveBeenCalled();
    expect(event.scopeNodeIds).toEqual([]);
  });
});
