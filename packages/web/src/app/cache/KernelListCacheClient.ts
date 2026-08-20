import type { CacheKernel } from './CacheKernel';

export interface CachedListRecord {
  id: string;
  items: string[];
}

/** Normalized list facade backed exclusively by CacheKernel. */
export class KernelListCacheClient {
  public constructor(
    private readonly kernel: CacheKernel,
    private readonly onChange: () => void,
  ) {}

  public get(id: string): CachedListRecord | null {
    return this.kernel.getRecord<CachedListRecord>('list', id);
  }

  public retain(id: string): void { void id; }
  public release(id: string): void { void id; }

  public subscribe(id: string, callback: (record: CachedListRecord | null) => void): () => void {
    return this.kernel.subscribeRecord('list', id, (record) => callback(record as CachedListRecord | null));
  }

  public inject(id: string, items: string[]): void {
    this.kernel.upsertRecord('list', { id, items }, { completeness: 'full' });
    this.onChange();
  }

  public remove(id: string): void {
    this.kernel.removeRecord('list', id);
    this.onChange();
  }

  public purge(): void {
    this.kernel.purgeNamespace('list');
    this.onChange();
  }
}
