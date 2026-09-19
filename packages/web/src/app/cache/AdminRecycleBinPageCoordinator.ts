/** Owns bounded cached windows for immutable recycle-bin operation projections. */
import type { AdminContentCatalogPage, RecycleBinOperationItem } from '@dashboard/core';
import { CacheKernel } from './CacheKernel';
import { QueryWindowStore } from './QueryWindowStore';
import { ResourceWindowIndex } from './ResourceWindowIndex';

const FAMILY = 'admin-recycle-bin-page:';
const NAMESPACE = 'admin-recycle-bin';
export type RecycleBinPageLoader = (input: { page: number; pageSize: number }) => Promise<AdminContentCatalogPage<RecycleBinOperationItem>>;

/** Coordinates page LRU and conservative family invalidation for the causal recycle-bin list. */
export class AdminRecycleBinPageCoordinator {
  public readonly index = new ResourceWindowIndex();
  private readonly windows = new QueryWindowStore<{ pageSize: number }>(this.index);
  private readonly pending = new Map<string, Promise<AdminContentCatalogPage<RecycleBinOperationItem>>>();
  private generation = 0;
  public constructor(private readonly kernel: CacheKernel, private readonly load: RecycleBinPageLoader, private readonly verify: () => Promise<boolean>) {}
  async read(input: { page: number; pageSize: number }): Promise<AdminContentCatalogPage<RecycleBinOperationItem>> {
    const key = `${FAMILY}${input.page}:${input.pageSize}`; const cached = this.windows.get(key);
    if (cached && await this.verify()) return this.resolve(cached);
    if (cached) this.release(this.windows.remove(key));
    const existing = this.pending.get(key); if (existing) return existing;
    const generation = this.generation;
    const request = this.load(input).then(async (page) => {
      if (generation !== this.generation) return this.read(input);
      page.items.forEach((item) => this.kernel.upsertRecord(NAMESPACE, item, { completeness: 'summary' }));
      this.windows.put({ key, descriptor: { pageSize: input.pageSize }, references: page.items.map((item) => ({ namespace: NAMESPACE, id: item.id })), page: page.page, pageCount: page.pageCount, total: page.total }).forEach((window) => this.release(window)); return page;
    }).finally(() => { if (this.pending.get(key) === request) this.pending.delete(key); }); this.pending.set(key, request); return request;
  }
  invalidateFamily(): void { this.generation += 1; this.windows.clear().forEach((window) => this.release(window)); }
  purge(): void { this.invalidateFamily(); }
  private resolve(window: { references: readonly { namespace: string; id: string }[]; page: number; pageCount: number; total: number }): AdminContentCatalogPage<RecycleBinOperationItem> { return { items: window.references.flatMap((ref) => { const item = this.kernel.getRecord<RecycleBinOperationItem>(ref.namespace, ref.id); return item ? [item] : []; }), page: window.page, pageCount: window.pageCount, total: window.total }; }
  private release(window: { references: readonly { namespace: string; id: string }[] } | null): void { window?.references.forEach((ref) => { if (!this.index.hasWindowsFor(ref)) this.kernel.removeRecord(ref.namespace, ref.id); }); }
}
