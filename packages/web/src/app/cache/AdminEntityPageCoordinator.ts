/** Coordinates normalized, bounded administrative entity query windows. */
import type {
  AdminContentCatalogPage,
  AdminContentCatalogSortKey,
  AdminEntityCatalogItem,
  RealtimeChangeType,
} from '@dashboard/core';
import type { CacheReadTraceStore } from './CacheReadTraceStore';
import { CacheKernel } from './CacheKernel';
import { QueryWindowStore } from './QueryWindowStore';
import { ResourceWindowIndex, type WindowResourceReference } from './ResourceWindowIndex';
import { AdminEntityQueryImpactPolicy, type AdminEntityQueryDescriptor, type AdminEntityQueryImpact } from './AdminEntityQueryImpactPolicy';

const NAMESPACE = 'admin-entity';
const FAMILY = 'admin-entities-page:';

export type AdminEntityPageLoader = (
  input: AdminEntityPageRequest,
) => Promise<AdminContentCatalogPage<AdminEntityCatalogItem>>;
export type AdminEntitySummaryLoader = (entityId: string) => Promise<AdminEntityCatalogItem | null>;
export type AdminEntitySummaryPatch = Pick<AdminEntityCatalogItem, 'id' | 'parentNodeId' | 'entityTypeId' | 'name' | 'description' | 'rowVersion'>;

/** Matches the server-action boundary without importing a server module into cache policy. */
export interface AdminEntityPageRequest {
  page: number;
  pageSize: number;
  search?: string;
  sort?: { key: 'path' | 'name' | 'type'; direction: 'ascending' | 'descending' };
}

/** Keeps page identity stable across equivalent UI requests. */
export function adminEntityWindowKey(input: AdminEntityPageRequest): string {
  return `${FAMILY}${JSON.stringify(input)}`;
}

/** Separates a query's semantic identity from its page window. */
export function adminEntityQueryDescriptor(input: AdminEntityPageRequest): AdminEntityQueryDescriptor {
  const search = input.search?.trim() || undefined;
  const sort = input.sort;
  return {
    familyKey: `${FAMILY}${JSON.stringify({ search, sort })}`,
    orderFields: adminEntityOrderFields(sort?.key),
    ...(search ? { search } : {}),
  };
}

/** Mirrors the SELECT/ORDER BY contract while keeping query-impact policy data-driven. */
function adminEntityOrderFields(sort: AdminContentCatalogSortKey | undefined): readonly AdminEntityQueryDescriptor['orderFields'][number][] {
  if (sort === 'name') return ['name', 'nodePath', 'id'];
  if (sort === 'type') return ['typeLabel', 'nodePath', 'name', 'id'];
  return ['nodePath', 'name', 'id'];
}

/** Owns page projection lifecycle; storage and membership remain delegated to small collaborators. */
export class AdminEntityPageCoordinator {
  public readonly index = new ResourceWindowIndex();
  private readonly windows = new QueryWindowStore<AdminEntityQueryDescriptor>(this.index);
  private readonly pendingReads = new Map<string, Promise<AdminContentCatalogPage<AdminEntityCatalogItem>>>();
  private generation = 0;

  public constructor(
    private readonly kernel: CacheKernel,
    private readonly loadPage: AdminEntityPageLoader,
    private readonly loadSummary: AdminEntitySummaryLoader,
    private readonly verifyCacheHit: () => Promise<boolean>,
    private readonly trace?: CacheReadTraceStore,
    private readonly impactPolicy = new AdminEntityQueryImpactPolicy(),
  ) {}

  public async read(input: AdminEntityPageRequest): Promise<AdminContentCatalogPage<AdminEntityCatalogItem>> {
    const key = adminEntityWindowKey(input);
    const cached = this.windows.get(key);
    if (cached) {
      const continuous = await this.verifyCacheHit();
      if (continuous) {
        this.trace?.record({ kind: 'read', key, source: 'cache', reason: 'continuity-confirmed' });
        return this.resolve(cached);
      }
      this.release(this.windows.remove(key));
    }

    const pending = this.pendingReads.get(key);
    if (pending) return pending;
    const requestGeneration = this.generation;
    this.trace?.record({ kind: 'read', key, source: 'backend', reason: cached ? 'continuity-unknown' : 'cache-miss' });
    const request = this.loadPage(input).then(async (page) => {
      if (this.generation !== requestGeneration) {
        if (this.pendingReads.get(key) === request) this.pendingReads.delete(key);
        return this.read(input);
      }
      page.items.forEach((item) => this.kernel.upsertRecord(NAMESPACE, item, { completeness: 'summary' }));
      const evicted = this.windows.put({
        key,
        descriptor: adminEntityQueryDescriptor(input),
        references: page.items.map((item) => ({ namespace: NAMESPACE, id: item.id })),
        page: page.page,
        pageCount: page.pageCount,
        total: page.total,
      });
      evicted.forEach((window) => this.release(window));
      return page;
    }).finally(() => {
      if (this.pendingReads.get(key) === request) this.pendingReads.delete(key);
    });
    this.pendingReads.set(key, request);
    return request;
  }

  /** Invalidates just the retained windows containing the changed summary record. */
  public invalidateResource(entityId: string): void {
    this.generation += 1;
    const reference = { namespace: NAMESPACE, id: entityId };
    this.index.windowsFor(reference).forEach((key) => this.release(this.windows.remove(key)));
  }

  /** Invalidates every query when membership, ACL, search or sort may have changed. */
  public invalidateFamily(): void {
    this.generation += 1;
    this.windows.invalidateMatching(() => true).forEach((window) => this.release(window));
    this.trace?.record({ kind: 'invalidation', key: FAMILY, reason: 'query-family' });
  }

  /** Reconciles an event notice through an ACL-authoritative summary before changing cached windows. */
  public async reconcileRealtimeEntity(entityId: string, changeType: RealtimeChangeType): Promise<AdminEntityQueryImpact> {
    const previous = this.kernel.getRecord<AdminEntityCatalogItem>(NAMESPACE, entityId);
    if (!previous && changeType !== 'created') {
      this.invalidateFamily();
      return 'invalidate-family';
    }
    const current = await this.loadSummary(entityId);
    return this.reconcileSummaries(previous, current);
  }

  /** Reconciles the authoritative response from a local entity update without another transport read. */
  public reconcileLocalEntity(patch: AdminEntitySummaryPatch): AdminEntityQueryImpact {
    const previous = this.kernel.getRecord<AdminEntityCatalogItem>(NAMESPACE, patch.id);
    if (!previous) {
      this.invalidateFamily();
      return 'invalidate-family';
    }
    return this.reconcileSummaries(previous, { ...previous, ...patch });
  }

  private reconcileSummaries(previous: AdminEntityCatalogItem | null, current: AdminEntityCatalogItem | null): AdminEntityQueryImpact {
    const impactedFamilies = new Set(
      this.windows.values()
        .filter((window) => this.impactPolicy.decide(previous, current, window.descriptor) === 'invalidate-family')
        .map((window) => window.descriptor.familyKey),
    );
    if (impactedFamilies.size > 0) {
      this.generation += 1;
      this.windows.invalidateMatching((window) => impactedFamilies.has(window.descriptor.familyKey))
        .forEach((window) => this.release(window));
      this.trace?.record({ kind: 'invalidation', key: [...impactedFamilies].join(','), reason: 'query-family-impact' });
    }
    const resourceId = current?.id ?? previous?.id;
    if (current && resourceId && this.index.hasWindowsFor({ namespace: NAMESPACE, id: resourceId })) {
      this.kernel.upsertRecord(NAMESPACE, current, { completeness: 'summary' });
    }
    return impactedFamilies.size > 0 ? 'invalidate-family' : current ? 'patch-record' : 'no-effect';
  }

  public purge(): void {
    this.generation += 1;
    this.windows.clear().forEach((window) => this.release(window));
  }

  private resolve(window: { references: readonly WindowResourceReference[]; page: number; pageCount: number; total: number }): AdminContentCatalogPage<AdminEntityCatalogItem> {
    return {
      items: window.references.flatMap((reference) => {
        const record = this.kernel.getRecord<AdminEntityCatalogItem>(reference.namespace, reference.id);
        return record ? [record] : [];
      }),
      total: window.total,
      page: window.page,
      pageCount: window.pageCount,
    };
  }

  private release(window: { references: readonly WindowResourceReference[] } | null): void {
    window?.references.forEach((reference) => {
      if (!this.index.hasWindowsFor(reference)) this.kernel.removeRecord(reference.namespace, reference.id);
    });
  }
}
