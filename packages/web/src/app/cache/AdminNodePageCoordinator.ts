/** Coordinates normalized, bounded administrative node query windows. */
import type { AdminContentCatalogPage, AdminContentCatalogSortKey, AdminNodeCatalogItem, RealtimeChangeType } from '@dashboard/core';
import type { CacheReadTraceStore } from './CacheReadTraceStore';
import { CacheKernel } from './CacheKernel';
import { QueryWindowStore } from './QueryWindowStore';
import { ResourceWindowIndex, type WindowResourceReference } from './ResourceWindowIndex';
import { AdminNodeQueryImpactPolicy, type AdminNodeQueryDescriptor, type AdminNodeQueryImpact } from './AdminNodeQueryImpactPolicy';

const NAMESPACE = 'admin-node';
const FAMILY = 'admin-nodes-page:';

export interface AdminNodePageRequest {
  page: number;
  pageSize: number;
  search?: string;
  sort?: { key: 'path' | 'name' | 'type'; direction: 'ascending' | 'descending' };
}

export type AdminNodePageLoader = (input: AdminNodePageRequest) => Promise<AdminContentCatalogPage<AdminNodeCatalogItem>>;
export type AdminNodeSummaryLoader = (nodeId: string) => Promise<AdminNodeCatalogItem | null>;
export type AdminNodeSummaryPatch = Pick<AdminNodeCatalogItem, 'id' | 'parentId' | 'nodeTypeId' | 'name' | 'description' | 'path' | 'pathLabel' | 'rowVersion'>;

/** Keeps page identity stable across equivalent UI requests. */
export function adminNodeWindowKey(input: AdminNodePageRequest): string { return `${FAMILY}${JSON.stringify(input)}`; }

/** Separates a query's semantic identity from its page window. */
export function adminNodeQueryDescriptor(input: AdminNodePageRequest): AdminNodeQueryDescriptor {
  const search = input.search?.trim() || undefined;
  const sort = input.sort;
  return { familyKey: `${FAMILY}${JSON.stringify({ search, sort })}`, orderFields: adminNodeOrderFields(sort?.key), ...(search ? { search } : {}) };
}

/** Mirrors the SELECT/ORDER BY contract while keeping query-impact policy data-driven. */
function adminNodeOrderFields(sort: AdminContentCatalogSortKey | undefined): readonly AdminNodeQueryDescriptor['orderFields'][number][] {
  if (sort === 'name') return ['name', 'path', 'id'];
  if (sort === 'type') return ['typeLabel', 'path', 'name', 'id'];
  return ['path', 'name', 'id'];
}

/** Owns node page projections; storage and membership remain delegated to small collaborators. */
export class AdminNodePageCoordinator {
  public readonly index = new ResourceWindowIndex();
  private readonly windows = new QueryWindowStore<AdminNodeQueryDescriptor>(this.index);
  private readonly pendingReads = new Map<string, Promise<AdminContentCatalogPage<AdminNodeCatalogItem>>>();
  private generation = 0;

  public constructor(
    private readonly kernel: CacheKernel,
    private readonly loadPage: AdminNodePageLoader,
    private readonly loadSummary: AdminNodeSummaryLoader,
    private readonly verifyCacheHit: () => Promise<boolean>,
    private readonly trace?: CacheReadTraceStore,
    private readonly impactPolicy = new AdminNodeQueryImpactPolicy(),
  ) {}

  public async read(input: AdminNodePageRequest): Promise<AdminContentCatalogPage<AdminNodeCatalogItem>> {
    const key = adminNodeWindowKey(input);
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
    const request = this.loadPage(input).then(async (page) => {
      if (this.generation !== requestGeneration) return this.read(input);
      page.items.forEach((item) => this.kernel.upsertRecord(NAMESPACE, item, { completeness: 'summary' }));
      this.windows.put({ key, descriptor: adminNodeQueryDescriptor(input), references: page.items.map((item) => ({ namespace: NAMESPACE, id: item.id })), page: page.page, pageCount: page.pageCount, total: page.total }).forEach((window) => this.release(window));
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

  /** Reconciles an event notice through an ACL-authoritative summary before changing cached windows. */
  public async reconcileRealtimeNode(nodeId: string, changeType: RealtimeChangeType): Promise<AdminNodeQueryImpact> {
    const previous = this.kernel.getRecord<AdminNodeCatalogItem>(NAMESPACE, nodeId);
    if (!previous && changeType !== 'created') { this.invalidateFamily(); return 'invalidate-family'; }
    return this.reconcileSummaries(previous, await this.loadSummary(nodeId));
  }

  /** Reconciles the authoritative local node update without another transport read. */
  public reconcileLocalNode(patch: AdminNodeSummaryPatch): AdminNodeQueryImpact {
    const previous = this.kernel.getRecord<AdminNodeCatalogItem>(NAMESPACE, patch.id);
    if (!previous) { this.invalidateFamily(); return 'invalidate-family'; }
    return this.reconcileSummaries(previous, { ...previous, ...patch });
  }

  public purge(): void { this.invalidateFamily(); }

  private reconcileSummaries(previous: AdminNodeCatalogItem | null, current: AdminNodeCatalogItem | null): AdminNodeQueryImpact {
    const impactedFamilies = new Set(this.windows.values().filter((window) => this.impactPolicy.decide(previous, current, window.descriptor) === 'invalidate-family').map((window) => window.descriptor.familyKey));
    if (impactedFamilies.size > 0) {
      this.generation += 1;
      this.windows.invalidateMatching((window) => impactedFamilies.has(window.descriptor.familyKey)).forEach((window) => this.release(window));
      this.trace?.record({ kind: 'invalidation', key: [...impactedFamilies].join(','), reason: 'query-family-impact' });
    }
    const resourceId = current?.id ?? previous?.id;
    if (current && resourceId && this.index.hasWindowsFor({ namespace: NAMESPACE, id: resourceId })) this.kernel.upsertRecord(NAMESPACE, current, { completeness: 'summary' });
    return impactedFamilies.size > 0 ? 'invalidate-family' : current ? 'patch-record' : 'no-effect';
  }

  private resolve(window: { references: readonly WindowResourceReference[]; page: number; pageCount: number; total: number }): AdminContentCatalogPage<AdminNodeCatalogItem> {
    return { items: window.references.flatMap((reference) => { const record = this.kernel.getRecord<AdminNodeCatalogItem>(reference.namespace, reference.id); return record ? [record] : []; }), total: window.total, page: window.page, pageCount: window.pageCount };
  }

  private release(window: { references: readonly WindowResourceReference[] } | null): void {
    window?.references.forEach((reference) => { if (!this.index.hasWindowsFor(reference)) this.kernel.removeRecord(reference.namespace, reference.id); });
  }
}
