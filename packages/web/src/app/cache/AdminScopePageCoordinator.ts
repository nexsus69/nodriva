/** Owns normalized, bounded windows for the authorized scope-assignment catalogue. */
import type {
  ScopeAssignmentDto,
  ScopeAssignmentListPageDto,
  ScopeAssignmentListPageParams,
} from '@dashboard/core';
import { CacheKernel } from './CacheKernel';
import { PagedWindowCoordinator } from './PagedWindowCoordinator';

const FAMILY = 'admin-scope-page:';
const NAMESPACE = 'admin-scope';

export type ScopePageLoader = (
  input: ScopeAssignmentListPageParams,
) => Promise<ScopeAssignmentListPageDto>;

/** Keeps only page mechanics; authorization, search and ordering stay in the read port. */
export class AdminScopePageCoordinator {
  private readonly windows: PagedWindowCoordinator<
    ScopeAssignmentListPageParams,
    { pageSize: number; search: string; sort: string },
    ScopeAssignmentListPageDto
  >;

  public constructor(
    private readonly kernel: CacheKernel,
    load: ScopePageLoader,
    private readonly verify: () => Promise<boolean>,
  ) {
    this.windows = new PagedWindowCoordinator(
      load,
      (input, page, key) => {
        page.items.forEach((item) => kernel.upsertRecord(NAMESPACE, item, { completeness: 'summary' }));
        return {
          key,
          descriptor: this.descriptor(input),
          references: page.items.map((item) => ({ namespace: NAMESPACE, id: item.id })),
          page: page.page,
          pageCount: page.pageCount,
          total: page.total,
        };
      },
      (window) => this.release(window),
    );
  }

  public async read(input: ScopeAssignmentListPageParams): Promise<ScopeAssignmentListPageDto> {
    const key = this.key(input);
    const cached = this.windows.get(key);
    if (cached && await this.verify()) return this.resolve(cached);
    if (cached) this.windows.remove(key);
    return this.windows.read(key, input);
  }

  public invalidateFamily(): void {
    this.windows.invalidate();
  }

  public purge(): void {
    this.invalidateFamily();
  }

  private key(input: ScopeAssignmentListPageParams): string {
    const descriptor = this.descriptor(input);
    return `${FAMILY}${input.page}:${descriptor.pageSize}:${descriptor.search}:${descriptor.sort}`;
  }

  private descriptor(input: ScopeAssignmentListPageParams) {
    return {
      pageSize: input.pageSize,
      search: input.search?.trim().toLocaleLowerCase() ?? '',
      sort: input.sort ? `${input.sort.key}:${input.sort.direction}` : 'user:ascending',
    };
  }

  private resolve(window: {
    references: readonly { namespace: string; id: string }[];
    page: number;
    pageCount: number;
    total: number;
  }): ScopeAssignmentListPageDto {
    return {
      items: window.references.flatMap((reference) => {
        const item = this.kernel.getRecord<ScopeAssignmentDto>(reference.namespace, reference.id);
        return item ? [item] : [];
      }),
      page: window.page,
      pageCount: window.pageCount,
      total: window.total,
    };
  }

  private release(window: { references: readonly { namespace: string; id: string }[] } | null): void {
    window?.references.forEach((reference) => {
      if (!this.windows.index.hasWindowsFor(reference)) {
        this.kernel.removeRecord(reference.namespace, reference.id);
      }
    });
  }
}
