/** Verifies realtime notices are routed to their owning cache-effect boundary. */
import { describe, expect, it, vi } from 'vitest';
import { RealtimeEventApplier, type RealtimeEventApplierPorts } from './RealtimeEventApplier';

function createPorts(): RealtimeEventApplierPorts {
  return {
    isLocalEvent: vi.fn(() => false),
    invalidateMetadata: vi.fn(), notifyAttachmentResourceChanged: vi.fn(), invalidateNode: vi.fn(),
    invalidateEntityReference: vi.fn(), notifyCacheChanged: vi.fn(), purgeUsers: vi.fn(),
    invalidateAdmin: vi.fn(), reconcileAdminEntity: vi.fn(), injectEntity: vi.fn(), injectNode: vi.fn(), applyResourceChange: vi.fn(),
    getLock: vi.fn(() => ({ locked: false })), setLock: vi.fn(),
  };
}

describe('RealtimeEventApplier', () => {
  it('routes an attachment event only to its resource and invalidates its entity reference', () => {
    const ports = createPorts();
    const applier = new RealtimeEventApplier(ports);

    applier.applyDataChanged({
      eventId: 'event-1', occurredAt: '2026-09-17T00:00:00.000Z', resourceType: 'entity', resourceId: 'entity-1',
      entityTypeId: 'task', changeType: 'updated', actorUserId: 'user-1', subresourceKind: 'attachment',
    });

    expect(ports.notifyAttachmentResourceChanged).toHaveBeenCalledWith({ resourceType: 'entity', resourceId: 'entity-1' });
    expect(ports.invalidateEntityReference).toHaveBeenCalledWith('task', 'entity-1');
    expect(ports.notifyCacheChanged).toHaveBeenCalledOnce();
  });

  it('does not apply a data event emitted by the local mutation session', () => {
    const ports = createPorts();
    vi.mocked(ports.isLocalEvent).mockReturnValue(true);
    const applier = new RealtimeEventApplier(ports);

    applier.applyDataChanged({
      eventId: 'event-1', occurredAt: '2026-09-17T00:00:00.000Z', resourceType: 'node', resourceId: 'node-1',
      changeType: 'updated', actorUserId: 'user-1',
    });

    expect(ports.applyResourceChange).not.toHaveBeenCalled();
    expect(ports.notifyCacheChanged).not.toHaveBeenCalled();
  });

  it('treats an entity event as a reconciliation notice, not a page-cache invalidation policy', () => {
    const ports = createPorts();
    const applier = new RealtimeEventApplier(ports);
    applier.applyDataChanged({
      eventId: 'event-1', occurredAt: '2026-09-17T00:00:00.000Z', resourceType: 'entity', resourceId: 'entity-1',
      entityTypeId: 'task', changeType: 'updated', actorUserId: 'user-1',
    });

    expect(ports.reconcileAdminEntity).toHaveBeenCalledWith('entity-1', 'updated');
    expect(ports.invalidateAdmin).not.toHaveBeenCalledWith(['subtree-entities', 'admin-entities-page']);
  });

  it('does not let a delayed lock release erase a newer session lock', () => {
    const ports = createPorts();
    vi.mocked(ports.getLock).mockReturnValue({ locked: true, bySessionId: 'newer-session' });
    const applier = new RealtimeEventApplier(ports);

    applier.applyLock('lock:released', { resourceType: 'entity', resourceId: 'entity-1', sessionId: 'older-session' });

    expect(ports.setLock).not.toHaveBeenCalled();
  });
});
