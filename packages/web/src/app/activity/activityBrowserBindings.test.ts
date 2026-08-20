import { describe, expect, it, vi } from 'vitest';
import {
  HUMAN_ACTIVITY_EVENTS,
  bindHumanActivity,
  bindVisibility,
  parseActivityChannelMessage,
} from './activityBrowserBindings';

class FakeTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): void {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
  }
}

class FakeDocument extends FakeTarget {
  visibilityState: DocumentVisibilityState = 'hidden';
}

describe('activity browser bindings', () => {
  it('observes every meaningful human event and removes all listeners', () => {
    const target = new FakeTarget();
    const listener = vi.fn();
    const unbind = bindHumanActivity(target, listener);

    for (const type of HUMAN_ACTIVITY_EVENTS) target.dispatchEvent(new Event(type));
    expect(listener.mock.calls.map(([event]) => event.type)).toEqual(HUMAN_ACTIVITY_EVENTS);

    unbind();
    for (const type of HUMAN_ACTIVITY_EVENTS) target.dispatchEvent(new Event(type));
    expect(listener).toHaveBeenCalledTimes(HUMAN_ACTIVITY_EVENTS.length);
  });

  it('checks visibility immediately, on foreground return, and stops after cleanup', () => {
    const target = new FakeDocument();
    const listener = vi.fn();
    const unbind = bindVisibility(target, listener);

    expect(listener).toHaveBeenLastCalledWith('hidden');
    target.visibilityState = 'visible';
    target.dispatchEvent(new Event('visibilitychange'));
    expect(listener).toHaveBeenLastCalledWith('visible');

    unbind();
    target.visibilityState = 'hidden';
    target.dispatchEvent(new Event('visibilitychange'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('accepts only valid cross-tab session messages', () => {
    expect(parseActivityChannelMessage({ type: 'renewed', expiresAt: '2026-08-20T12:00:00Z' }))
      .toEqual({ type: 'renewed', expiresAt: '2026-08-20T12:00:00Z' });
    expect(parseActivityChannelMessage({ type: 'expired' })).toEqual({ type: 'expired' });
    expect(parseActivityChannelMessage({ type: 'renewed' })).toBeNull();
    expect(parseActivityChannelMessage({ type: 'unknown', expiresAt: 'value' })).toBeNull();
    expect(parseActivityChannelMessage(null)).toBeNull();
  });
});
