/** Publishes monotonic cache revisions to consumers that need a broad cache refresh signal. */
export class CacheRevisionStore {
  private revision = 0;
  private readonly subscribers = new Set<() => void>();

  public getRevision(): number {
    return this.revision;
  }

  public subscribe(subscriber: () => void): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  public notifyChanged(): void {
    this.revision += 1;
    this.subscribers.forEach((subscriber) => subscriber());
  }
}
