/** Coordinates immutable, bounded audit query windows and their canonical summaries. */
import type { AuditLogFilterDto, AuditLogListItemDto, PaginatedResultDto } from '@dashboard/core';
import type { CacheReadTraceStore } from './CacheReadTraceStore';
import { CacheKernel } from './CacheKernel';
import { QueryWindowStore } from './QueryWindowStore';
import { ResourceWindowIndex, type WindowResourceReference } from './ResourceWindowIndex';

const FAMILY = 'admin-audit-page:';
const NAMESPACE = 'admin-audit';

interface AuditWindowDescriptor { pageSize: number; }

export type AdminAuditPageLoader = (filters: AuditLogFilterDto) => Promise<PaginatedResultDto<AuditLogListItemDto>>;

/** Makes equivalent filter objects address the same bounded query window. */
export function adminAuditWindowKey(filters: AuditLogFilterDto): string {
  const normalized: AuditLogFilterDto = {
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.actionKey ? { actionKey: filters.actionKey } : {}),
    ...(filters.actionKeyPrefix ? { actionKeyPrefix: filters.actionKeyPrefix } : {}),
    ...(filters.resourceKind ? { resourceKind: filters.resourceKind } : {}),
    ...(filters.resourceId ? { resourceId: filters.resourceId } : {}),
    ...(filters.nodeId ? { nodeId: filters.nodeId } : {}),
    ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(filters.toDate ? { toDate: filters.toDate } : {}),
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 25,
  };
  return `${FAMILY}${JSON.stringify(normalized)}`;
}

/** Owns audit-page retention; a generic audit event invalidates only this query family. */
export class AdminAuditPageCoordinator {
  public readonly index = new ResourceWindowIndex();
  private readonly windows = new QueryWindowStore<AuditWindowDescriptor>(this.index);
  private readonly pendingReads = new Map<string, Promise<PaginatedResultDto<AuditLogListItemDto>>>();
  private generation = 0;

  public constructor(
    private readonly kernel: CacheKernel,
    private readonly loadPage: AdminAuditPageLoader,
    private readonly verifyCacheHit: () => Promise<boolean>,
    private readonly trace?: CacheReadTraceStore,
  ) {}

  public async read(filters: AuditLogFilterDto): Promise<PaginatedResultDto<AuditLogListItemDto>> {
    const key = adminAuditWindowKey(filters);
    const cached = this.windows.get(key);
    if (cached) {
      if (await this.verifyCacheHit()) {
        this.trace?.record({ kind: 'read', key, source: 'cache', reason: 'continuity-confirmed' });
        return this.resolve(cached);
      }
      this.release(this.windows.remove(key));
    }
    const pending = this.pendingReads.get(key);
    if (pending) return pending;
    const requestGeneration = this.generation;
    this.trace?.record({ kind: 'read', key, source: 'backend', reason: cached ? 'continuity-unknown' : 'cache-miss' });
    const request = this.loadPage(filters).then(async (page) => {
      if (this.generation !== requestGeneration) return this.read(filters);
      page.items.forEach((item) => this.kernel.upsertRecord(NAMESPACE, item, { completeness: 'summary' }));
      this.windows.put({
        key,
        descriptor: { pageSize: page.pageSize },
        references: page.items.map((item) => ({ namespace: NAMESPACE, id: item.id })),
        page: page.page,
        pageCount: page.totalPages,
        total: page.total,
      }).forEach((window) => this.release(window));
      return page;
    }).finally(() => { if (this.pendingReads.get(key) === request) this.pendingReads.delete(key); });
    this.pendingReads.set(key, request);
    return request;
  }

  public invalidateFamily(): void {
    this.generation += 1;
    this.windows.invalidateMatching(() => true).forEach((window) => this.release(window));
    this.trace?.record({ kind: 'invalidation', key: FAMILY, reason: 'query-family' });
  }

  public purge(): void { this.invalidateFamily(); }

  private resolve(window: { descriptor: AuditWindowDescriptor; references: readonly WindowResourceReference[]; page: number; pageCount: number; total: number }): PaginatedResultDto<AuditLogListItemDto> {
    return {
      items: window.references.flatMap((reference) => {
        const record = this.kernel.getRecord<AuditLogListItemDto>(reference.namespace, reference.id);
        return record ? [record] : [];
      }),
      total: window.total,
      page: window.page,
      pageSize: window.descriptor.pageSize,
      totalPages: window.pageCount,
    };
  }

  private release(window: { references: readonly WindowResourceReference[] } | null): void {
    window?.references.forEach((reference) => {
      if (!this.index.hasWindowsFor(reference)) this.kernel.removeRecord(reference.namespace, reference.id);
    });
  }
}
