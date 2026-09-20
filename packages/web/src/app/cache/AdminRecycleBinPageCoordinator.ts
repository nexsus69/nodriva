/** Owns bounded cached windows for immutable recycle-bin operation projections. */
import type { AdminContentCatalogPage, RecycleBinOperationItem } from '@dashboard/core';
import { CacheKernel } from './CacheKernel';
import { PagedWindowCoordinator } from './PagedWindowCoordinator';

const FAMILY = 'admin-recycle-bin-page:';
const NAMESPACE = 'admin-recycle-bin';
export type RecycleBinPageLoader = (input: { page: number; pageSize: number }) => Promise<AdminContentCatalogPage<RecycleBinOperationItem>>;

/** Coordinates page LRU and conservative family invalidation for the causal recycle-bin list. */
export class AdminRecycleBinPageCoordinator {
  private readonly windows: PagedWindowCoordinator<
    { page: number; pageSize: number },
    { pageSize: number },
    AdminContentCatalogPage<RecycleBinOperationItem>
  >;

  public constructor(
    private readonly kernel: CacheKernel,
    load: RecycleBinPageLoader,
    private readonly verify: () => Promise<boolean>,
  ) {
    this.windows = new PagedWindowCoordinator(
      load,
      (input, page, key) => {
        page.items.forEach((item) => kernel.upsertRecord(NAMESPACE, item, { completeness: 'summary' }));
        return {
          key,
          descriptor: { pageSize: input.pageSize },
          references: page.items.map((item) => ({ namespace: NAMESPACE, id: item.id })),
          page: page.page,
          pageCount: page.pageCount,
          total: page.total,
        };
      },
      (window) => this.release(window),
    );
  }

  async read(input: { page: number; pageSize: number }): Promise<AdminContentCatalogPage<RecycleBinOperationItem>> {
    const key = `${FAMILY}${input.page}:${input.pageSize}`;
    const cached = this.windows.get(key);
    if (cached && await this.verify()) return this.resolve(cached);
    if (cached) this.windows.remove(key);
    return this.windows.read(key, input);
  }

  invalidateFamily(): void {
    this.windows.invalidate();
  }

  purge(): void {
    this.invalidateFamily();
  }

  private resolve(window: {
    references: readonly { namespace: string; id: string }[];
    page: number;
    pageCount: number;
    total: number;
  }): AdminContentCatalogPage<RecycleBinOperationItem> {
    return {
      items: window.references.flatMap((ref) => {
        const item = this.kernel.getRecord<RecycleBinOperationItem>(ref.namespace, ref.id);
        return item ? [item] : [];
      }),
      page: window.page,
      pageCount: window.pageCount,
      total: window.total,
    };
  }

  private release(window: { references: readonly { namespace: string; id: string }[] } | null): void {
    window?.references.forEach((ref) => {
      if (!this.windows.index.hasWindowsFor(ref)) this.kernel.removeRecord(ref.namespace, ref.id);
    });
  }
}
