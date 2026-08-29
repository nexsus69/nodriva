/** Exercises the browser realtime bridge through administrative cache invalidations. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalCacheClient } from "./GlobalCacheClient";

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
    connection = { bind: vi.fn() };
    channels = new Map<string, MockChannel>();

    constructor() {
      HoistedMockPusher.instance = this;
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
});
