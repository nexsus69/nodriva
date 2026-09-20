/** Owns normalized bounded windows for the administrative role catalogue. */
import type { RoleListItemDto, RoleListPageDto, RoleListPageParams } from '@dashboard/core';
import { CacheKernel } from './CacheKernel';
import { PagedWindowCoordinator } from './PagedWindowCoordinator';

const FAMILY = 'admin-role-page:';
const NAMESPACE = 'admin-role';

export class AdminRolePageCoordinator {
  private readonly windows: PagedWindowCoordinator<RoleListPageParams, string, RoleListPageDto>;

  public constructor(
    private readonly kernel: CacheKernel,
    private readonly load: (input: RoleListPageParams) => Promise<RoleListPageDto>,
    private readonly verify: () => Promise<boolean>,
  ) {
    this.windows = new PagedWindowCoordinator(load, (input, page, key) => {
      page.items.forEach((item) => kernel.upsertRecord(NAMESPACE, item, { completeness: 'summary' }));
      return { key, descriptor: this.descriptor(input), references: page.items.map((item) => ({ namespace: NAMESPACE, id: item.id })), page: page.page, pageCount: page.pageCount, total: page.total };
    }, (window) => this.release(window));
  }

  public async read(input: RoleListPageParams): Promise<RoleListPageDto> {
    const key = `${FAMILY}${input.page}:${this.descriptor(input)}`;
    const cached = this.windows.get(key);
    if (cached && await this.verify()) return this.resolve(cached);
    if (cached) this.windows.remove(key);
    return this.windows.read(key, input);
  }

  public invalidateFamily(): void { this.windows.invalidate(); }
  public purge(): void { this.invalidateFamily(); }

  private descriptor(input: RoleListPageParams): string {
    return `${input.pageSize}:${input.search?.trim().toLocaleLowerCase() ?? ''}:${input.sort ? `${input.sort.key}:${input.sort.direction}` : 'name:ascending'}`;
  }

  private resolve(window: { references: readonly { namespace: string; id: string }[]; page: number; pageCount: number; total: number }): RoleListPageDto {
    return { items: window.references.flatMap((reference) => { const item = this.kernel.getRecord<RoleListItemDto>(reference.namespace, reference.id); return item ? [item] : []; }), page: window.page, pageCount: window.pageCount, total: window.total };
  }

  private release(window: { references: readonly { namespace: string; id: string }[] } | null): void {
    window?.references.forEach((reference) => { if (!this.windows.index.hasWindowsFor(reference)) this.kernel.removeRecord(reference.namespace, reference.id); });
  }
}
