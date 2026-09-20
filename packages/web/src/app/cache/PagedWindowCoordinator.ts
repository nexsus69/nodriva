/** Provides the mechanical lifecycle of normalized, bounded paged query windows. */
import { QueryWindowStore } from './QueryWindowStore';
import { ResourceWindowIndex, type WindowResourceReference } from './ResourceWindowIndex';

export interface PagedWindow<TDescriptor> {
  key: string;
  descriptor: TDescriptor;
  references: readonly WindowResourceReference[];
  page: number;
  pageCount: number;
  total: number;
}

/** Owns no query policy or payload: callers supply loading, normalization and record retention. */
export class PagedWindowCoordinator<TInput, TDescriptor, TPage> {
  public readonly index = new ResourceWindowIndex();
  private readonly windows: QueryWindowStore<TDescriptor>;
  private readonly pending = new Map<string, Promise<TPage>>();
  private generation = 0;

  public constructor(
    private readonly load: (input: TInput, generation: number) => Promise<TPage>,
    private readonly store: (input: TInput, page: TPage, key: string) => PagedWindow<TDescriptor>,
    private readonly release: (window: PagedWindow<TDescriptor> | null) => void,
    limit = 5,
  ) {
    this.windows = new QueryWindowStore(this.index, limit);
  }

  public get(key: string): PagedWindow<TDescriptor> | null {
    return this.windows.get(key);
  }

  public read(key: string, input: TInput): Promise<TPage> {
    const active = this.pending.get(key); if (active) return active;
    const request = this.loadCurrent(key, input).finally(() => {
      if (this.pending.get(key) === request) this.pending.delete(key);
    });
    this.pending.set(key, request); return request;
  }

  public remove(key: string): void {
    this.release(this.windows.remove(key));
  }

  public invalidate(matches: (window: PagedWindow<TDescriptor>) => boolean = () => true): void {
    this.generation += 1;
    this.windows.invalidateMatching(matches).forEach((window) => this.release(window));
  }

  public values(): readonly PagedWindow<TDescriptor>[] {
    return this.windows.values();
  }

  private async loadCurrent(key: string, input: TInput): Promise<TPage> {
    const generation = this.generation;
    const page = await this.load(input, generation);
    if (generation !== this.generation) return this.loadCurrent(key, input);
    this.windows.put(this.store(input, page, key)).forEach((window) => this.release(window));
    return page;
  }
}
