/** Publishes targeted administrative collection invalidations to active UI surfaces. */
export class AdminRealtimeInvalidationBus {
  private readonly subscribers = new Set<(keys: readonly string[]) => void>();

  public subscribe(subscriber: (keys: readonly string[]) => void): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  public publish(keys: readonly string[]): void {
    this.subscribers.forEach((subscriber) => subscriber(keys));
  }
}
