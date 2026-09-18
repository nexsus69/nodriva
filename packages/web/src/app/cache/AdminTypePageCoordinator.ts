/** Coordinates normalized, bounded administrative type query windows. */
import type { TypeKind, TypeListItemDto, TypeListPage } from '@dashboard/core';
import type { CacheReadTraceStore } from './CacheReadTraceStore';
import { CacheKernel } from './CacheKernel';
import { QueryWindowStore } from './QueryWindowStore';
import { ResourceWindowIndex, type WindowResourceReference } from './ResourceWindowIndex';
import { AdminTypeQueryImpactPolicy, type AdminTypeQueryDescriptor, type AdminTypeQueryImpact } from './AdminTypeQueryImpactPolicy';

const FAMILY = 'admin-types-page:';

function namespace(kind: TypeKind): string { return `admin-type:${kind}`; }

export interface AdminTypePageRequest {
  page: number;
  pageSize: number;
  search?: string;
  sort?: { key: 'name' | 'typeKey' | 'fields' | 'version'; direction: 'ascending' | 'descending' };
}

export type AdminTypePageLoader = (kind: TypeKind, input: AdminTypePageRequest) => Promise<TypeListPage>;
export type AdminTypeSummaryLoader = (kind: TypeKind, typeKey: string) => Promise<TypeListItemDto | null>;

export function adminTypeWindowKey(kind: TypeKind, input: AdminTypePageRequest): string { return `${FAMILY}${kind}:${JSON.stringify(input)}`; }

export function adminTypeQueryDescriptor(kind: TypeKind, input: AdminTypePageRequest): AdminTypeQueryDescriptor {
  const search = input.search?.trim() || undefined;
  const sort = input.sort;
  return { familyKey: `${FAMILY}${kind}:${JSON.stringify({ search, sort })}`, orderFields: adminTypeOrderFields(sort?.key), ...(search ? { search } : {}) };
}

function adminTypeOrderFields(sort: NonNullable<AdminTypePageRequest['sort']>['key'] | undefined): readonly AdminTypeQueryDescriptor['orderFields'][number][] {
  if (sort === 'typeKey') return ['typeKey', 'name', 'id'];
  if (sort === 'fields') return ['fieldCount', 'name', 'id'];
  if (sort === 'version') return ['currentSchemaVersion', 'name', 'id'];
  return ['name', 'id'];
}

/** Owns type page projections; page storage and query policy stay independent. */
export class AdminTypePageCoordinator {
  public readonly index = new ResourceWindowIndex();
  private readonly windows = new QueryWindowStore<AdminTypeQueryDescriptor>(this.index);
  private readonly pendingReads = new Map<string, Promise<TypeListPage>>();
  private generation = 0;

  public constructor(
    private readonly kernel: CacheKernel,
    private readonly loadPage: AdminTypePageLoader,
    private readonly loadSummary: AdminTypeSummaryLoader,
    private readonly verifyCacheHit: () => Promise<boolean>,
    private readonly trace?: CacheReadTraceStore,
    private readonly impactPolicy = new AdminTypeQueryImpactPolicy(),
  ) {}

  public async read(kind: TypeKind, input: AdminTypePageRequest): Promise<TypeListPage> {
    const key = adminTypeWindowKey(kind, input);
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
    const request = this.loadPage(kind, input).then(async (page) => {
      if (this.generation !== requestGeneration) return this.read(kind, input);
      page.items.forEach((item) => this.kernel.upsertRecord(namespace(kind), item, { completeness: 'summary' }));
      this.windows.put({ key, descriptor: adminTypeQueryDescriptor(kind, input), references: page.items.map((item) => ({ namespace: namespace(kind), id: item.id })), page: page.page, pageCount: page.pageCount, total: page.total }).forEach((window) => this.release(window));
      return page;
    }).finally(() => { if (this.pendingReads.get(key) === request) this.pendingReads.delete(key); });
    this.pendingReads.set(key, request);
    return request;
  }

  public async reconcile(kind: TypeKind, typeKey: string): Promise<AdminTypeQueryImpact> {
    const current = await this.loadSummary(kind, typeKey);
    const previous = this.windows.values()
      .filter((window) => window.key.startsWith(`${FAMILY}${kind}:`))
      .flatMap((window) => window.references)
      .map((reference) => this.kernel.getRecord<TypeListItemDto>(reference.namespace, reference.id))
      .find((item) => item?.typeKey === typeKey) ?? null;
    return this.reconcileSummaries(previous, current, namespace(kind));
  }

  public invalidateFamily(kind?: TypeKind): void {
    this.generation += 1;
    const prefix = kind ? `${FAMILY}${kind}:` : FAMILY;
    this.windows.invalidateMatching((window) => window.key.startsWith(prefix)).forEach((window) => this.release(window));
    this.trace?.record({ kind: 'invalidation', key: prefix, reason: 'query-family' });
  }

  public purge(): void { this.invalidateFamily(); }

  private reconcileSummaries(previous: TypeListItemDto | null, current: TypeListItemDto | null, recordNamespace: string): AdminTypeQueryImpact {
    const impactedFamilies = new Set(this.windows.values().filter((window) => this.impactPolicy.decide(previous, current, window.descriptor) === 'invalidate-family').map((window) => window.descriptor.familyKey));
    if (impactedFamilies.size > 0) {
      this.generation += 1;
      this.windows.invalidateMatching((window) => impactedFamilies.has(window.descriptor.familyKey)).forEach((window) => this.release(window));
      this.trace?.record({ kind: 'invalidation', key: [...impactedFamilies].join(','), reason: 'query-family-impact' });
    }
    const resourceId = current?.id ?? previous?.id;
    if (current && resourceId && this.index.hasWindowsFor({ namespace: recordNamespace, id: resourceId })) this.kernel.upsertRecord(recordNamespace, current, { completeness: 'summary' });
    return impactedFamilies.size > 0 ? 'invalidate-family' : current ? 'patch-record' : 'no-effect';
  }

  private resolve(window: { references: readonly WindowResourceReference[]; page: number; pageCount: number; total: number }): TypeListPage {
    return { items: window.references.flatMap((reference) => { const record = this.kernel.getRecord<TypeListItemDto>(reference.namespace, reference.id); return record ? [record] : []; }), total: window.total, page: window.page, pageCount: window.pageCount };
  }

  private release(window: { references: readonly WindowResourceReference[] } | null): void {
    window?.references.forEach((reference) => { if (!this.index.hasWindowsFor(reference)) this.kernel.removeRecord(reference.namespace, reference.id); });
  }
}
