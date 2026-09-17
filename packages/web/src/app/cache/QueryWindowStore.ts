/** Stores bounded ordered query windows while delegating resource membership to ResourceWindowIndex. */
import { ResourceWindowIndex, type WindowResourceReference } from './ResourceWindowIndex';

export interface QueryWindow<TDescriptor = unknown> {
  key: string;
  descriptor: TDescriptor;
  references: readonly WindowResourceReference[];
  page: number;
  pageCount: number;
  total: number;
}

/** Owns LRU retention of query windows, never resource payloads or fetch decisions. */
export class QueryWindowStore<TDescriptor = unknown> {
  private readonly windows = new Map<string, QueryWindow<TDescriptor>>();
  public constructor(private readonly index: ResourceWindowIndex, private readonly limit = 5) {}

  public get(key: string): QueryWindow<TDescriptor> | null {
    const window = this.windows.get(key);
    if (!window) return null;
    this.windows.delete(key);
    this.windows.set(key, window);
    return window;
  }

  public put(window: QueryWindow<TDescriptor>): readonly QueryWindow<TDescriptor>[] {
    const removed = this.remove(window.key);
    this.windows.set(window.key, window);
    this.index.replaceWindow(window.key, window.references);
    const evicted = removed ? [removed] : [];
    while (this.windows.size > this.limit) {
      const oldest = this.remove(this.windows.keys().next().value!);
      if (oldest) evicted.push(oldest);
    }
    return evicted;
  }

  public remove(key: string): QueryWindow<TDescriptor> | null {
    const window = this.windows.get(key) ?? null;
    this.windows.delete(key);
    this.index.removeWindow(key);
    return window;
  }

  public invalidateMatching(matches: (window: QueryWindow<TDescriptor>) => boolean): readonly QueryWindow<TDescriptor>[] {
    return [...this.windows.values()]
      .filter(matches)
      .map((window) => window.key)
      .flatMap((key) => this.remove(key) ?? []);
  }

  public values(): readonly QueryWindow<TDescriptor>[] { return [...this.windows.values()]; }

  public clear(): readonly QueryWindow<TDescriptor>[] {
    const windows = [...this.windows.values()];
    this.windows.clear();
    this.index.clear();
    return windows;
  }
}
