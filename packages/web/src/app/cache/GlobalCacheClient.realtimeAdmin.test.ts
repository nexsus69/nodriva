/** Exercises the browser realtime bridge through administrative cache invalidations. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalCacheClient } from "./GlobalCacheClient";
import { receiveAttachmentCollection } from '../attachments/attachmentCollectionModel';

type Handler = (payload: unknown) => void;

class MockChannel {
  private readonly handlers = new Map<string, Handler[]>();

  bind(eventName: string, handler: Handler): void {
    this.handlers.set(eventName, [...(this.handlers.get(eventName) ?? []), handler]);
  }

  unbind(): void {}

  emit(eventName: string, payload: unknown): void {
    this.handlers.get(eventName)?.forEach((handler) => handler(payload));
  }
}

const { MockPusher } = vi.hoisted(() => {
  class HoistedMockPusher {
    static instance: HoistedMockPusher;
    private readonly connectionHandlers = new Map<string, Handler[]>();
    connection = {
      bind: vi.fn((eventName: string, handler: Handler) => {
        this.connectionHandlers.set(eventName, [...(this.connectionHandlers.get(eventName) ?? []), handler]);
      }),
    };
    channels = new Map<string, MockChannel>();

    constructor() {
      HoistedMockPusher.instance = this;
    }

    emitConnection(eventName: string, payload: unknown): void {
      this.connectionHandlers.get(eventName)?.forEach((handler) => handler(payload));
    }

    subscribe(channelName: string): MockChannel {
      const channel = this.channels.get(channelName) ?? new MockChannel();
      this.channels.set(channelName, channel);
      return channel;
    }

    unsubscribe(): void {}
    disconnect(): void {}
  }

  return { MockPusher: HoistedMockPusher };
});

vi.mock("pusher-js", () => ({ default: MockPusher }));

describe("GlobalCacheClient administrative realtime invalidation", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_REALTIME_ENABLED = "true";
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    MockPusher.instance = undefined as unknown as InstanceType<typeof MockPusher>;
  });

  it("emits semantic recycle and audit dependencies for an authorized audit event", () => {
    const cache = new GlobalCacheClient();
    const invalidations: Array<readonly string[]> = [];
    cache.subscribeAdminRealtimeInvalidations((keys) => invalidations.push(keys));

    (cache as unknown as { applyRealtimeEvent: (event: unknown) => void }).applyRealtimeEvent({
      eventId: "event-1",
      occurredAt: "2026-08-29T00:00:00.000Z",
      resourceType: "audit",
      resourceId: "node:node-1",
      changeType: "deleted",
      actorUserId: "user-1",
    });

    expect(invalidations).toEqual([["audit", "deleted-nodes", "deleted-entities"]]);
  });

  it("bridges an authorized metadata event to subscribed type collections", () => {
    const cache = new GlobalCacheClient();
    const invalidations: Array<readonly string[]> = [];
    vi.spyOn(cache.metadata, "invalidate").mockImplementation(() => undefined);
    cache.subscribeAdminRealtimeInvalidations((keys) => invalidations.push(keys));
    cache.retainRealtimeChannels(["admin-data"], []);

    MockPusher.instance.channels.get("admin-data")?.emit("data:changed", {
      eventId: "event-2",
      occurredAt: "2026-08-29T00:00:00.000Z",
      resourceType: "node_type",
      resourceId: "project",
      changeType: "updated",
      actorUserId: "user-1",
      metadataKind: "node",
      metadataSequence: 1,
    });

    expect(invalidations).toEqual([["types", "type-detail", "type-definition"]]);
  });

  it('notifies only the affected attachment collection after a realtime attachment change', () => {
    const cache = new GlobalCacheClient();
    const changed = vi.fn();
    const untouched = vi.fn();
    cache.subscribeAttachmentCollectionInvalidation({ resourceType: 'entity', resourceId: 'entity-1' }, changed);
    cache.subscribeAttachmentCollectionInvalidation({ resourceType: 'entity', resourceId: 'entity-2' }, untouched);

    (cache as unknown as { applyRealtimeEvent: (event: unknown) => void }).applyRealtimeEvent({
      eventId: 'attachment-1',
      occurredAt: '2026-09-09T00:00:00.000Z',
      resourceType: 'entity',
      resourceId: 'entity-1',
      entityTypeId: 'task',
      changeType: 'updated',
      actorUserId: 'user-1',
      subresourceKind: 'attachment',
    });

    expect(changed).toHaveBeenCalledOnce();
    expect(untouched).not.toHaveBeenCalled();
  });

  it('keeps one shared attachment snapshot per resource collection', () => {
    const cache = new GlobalCacheClient();
    const target = { resourceType: 'node' as const, resourceId: 'node-1', fieldKey: 'documents', kind: 'file' as const };
    const changed = vi.fn();
    cache.subscribeAttachmentCollection(target, changed);
    const state = receiveAttachmentCollection([{
      id: 'attachment-1', resourceType: 'node', resourceId: 'node-1', fieldKey: 'documents', kind: 'file', fileName: 'brief.pdf', mimeType: 'application/pdf', sizeBytes: 10,
    }]);

    cache.setAttachmentCollection(target, state);

    expect(cache.getAttachmentCollection(target)).toBe(state);
    expect(changed).toHaveBeenCalledOnce();
  });

  it('keeps authenticated bootstrap loads alive when realtime starts disabled but requires their revalidation', () => {
    const cache = new GlobalCacheClient();
    const epoch = cache.getCacheEpoch();
    cache.nodes.inject('node-1', { id: 'node-1', name: 'Bootstrap node' } as never);

    cache.setRealtimeEnabled(false);

    expect(cache.getRealtimeReadModelState()).toBe('disabled');
    expect(cache.getCacheEpoch()).toBe(epoch);
    expect(cache.nodes.get('node-1')?.name).toBe('Bootstrap node');
    expect(cache.nodes.needsFetch('node-1', true)).toBe(true);
  });

  it('purges a previously trusted read model when realtime is disabled', () => {
    const cache = new GlobalCacheClient();
    cache.observeRealtimeCheckpoints([{ channelId: 'channel-data', epoch: 'epoch-1', cursor: 1 }]);
    cache.nodes.inject('node-1', { id: 'node-1', name: 'Cached node' } as never);

    cache.setRealtimeEnabled(false);

    expect(cache.getRealtimeReadModelState()).toBe('disabled');
    expect(cache.nodes.get('node-1')).toBeNull();
  });

  it('abandons the shared read model after a realtime transport outage and forces the next authoritative read', () => {
    const cache = new GlobalCacheClient();
    cache.retainRealtimeChannels(['channel-data'], []);
    cache.observeRealtimeCheckpoints([{ channelId: 'channel-data', epoch: 'epoch-1', cursor: 3 }]);
    cache.nodes.inject('node-1', { id: 'node-1', name: 'Cached node' } as never);

    MockPusher.instance.emitConnection('state_change', { current: 'unavailable' });

    expect(cache.getRealtimeReadModelState()).toBe('unreliable');
    expect(cache.nodes.get('node-1')).toBeNull();
    expect(cache.nodes.needsFetch('node-1', true)).toBe(true);
  });

  it('purges the read model when a channel checkpoint proves the browser missed events', () => {
    const cache = new GlobalCacheClient();
    cache.observeRealtimeCheckpoints([{ channelId: 'channel-data', epoch: 'epoch-1', cursor: 1 }]);
    cache.nodes.inject('node-1', { id: 'node-1', name: 'Cached node' } as never);

    cache.observeRealtimeCheckpoints([{ channelId: 'channel-data', epoch: 'epoch-1', cursor: 2 }]);

    expect(cache.getRealtimeReadModelState()).toBe('unreliable');
    expect(cache.nodes.get('node-1')).toBeNull();
  });
});
