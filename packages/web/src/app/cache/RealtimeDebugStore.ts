/** Retains a bounded diagnostic history of received realtime transport events. */
import type { RealtimeDebugEvent } from './RealtimeCacheBridge';

export class RealtimeDebugStore {
  private events: RealtimeDebugEvent[] = [];
  private readonly subscribers = new Set<(events: RealtimeDebugEvent[]) => void>();

  public getEvents(): RealtimeDebugEvent[] {
    return this.events;
  }

  public subscribe(subscriber: (events: RealtimeDebugEvent[]) => void): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.events);
    return () => this.subscribers.delete(subscriber);
  }

  public append(event: RealtimeDebugEvent): void {
    this.events = [...this.events, event].slice(-200);
    this.publish();
  }

  public clear(): void {
    this.events = [];
    this.publish();
  }

  private publish(): void {
    this.subscribers.forEach((subscriber) => subscriber(this.events));
  }
}
