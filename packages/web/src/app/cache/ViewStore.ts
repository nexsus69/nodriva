/** Owns semantic view state, dependency invalidation, and stale-response revisions. */
import type { RecordCompleteness } from './CacheKernel';

export const VIEW_DEPENDENCIES = {
  entityMembership: 'entity-membership',
  nodeHierarchy: 'node-hierarchy',
  nodeChildren: 'node-children-view',
  nodeMetadata: 'metadata:node',
  entityMetadata: 'metadata:entity',
} as const;

/** Returns the authoritative dependency set before a semantic view starts loading. */
export function getSemanticViewDependencyTokens(
  viewType: string,
  metadataType?: 'node' | 'entity',
): string[] {
  switch (viewType) {
    case 'SUBTREE_LIST':
      return [VIEW_DEPENDENCIES.entityMembership, VIEW_DEPENDENCIES.nodeHierarchy];
    case 'BREADCRUMB':
      return [VIEW_DEPENDENCIES.nodeHierarchy];
    case 'NODE_CHILDREN_LIST':
      return [VIEW_DEPENDENCIES.nodeChildren];
    case 'NODE_ENTITY_COLLECTION':
      return [VIEW_DEPENDENCIES.entityMembership];
    case 'METADATA_LIST':
      return [
        metadataType === 'node'
          ? VIEW_DEPENDENCIES.nodeMetadata
          : VIEW_DEPENDENCIES.entityMetadata,
      ];
    default:
      return [];
  }
}

export type CacheRecordNamespace =
  | 'node'
  | `entity:${string}`
  | 'node-type'
  | 'entity-type';

export interface CacheRecordReference {
  namespace: CacheRecordNamespace;
  id: string;
  completeness: RecordCompleteness;
}

export type ViewItemDescriptor =
  | { type: 'row'; reference: CacheRecordReference; requires?: CacheRecordReference[] }
  | { type: 'group'; groupId: string; label: string };

export type ViewStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ViewError {
  code: string;
  message: string;
  timestamp: number;
}

export type SatisfactionStatus = 
  | 'missing-view'
  | 'missing-records'
  | 'partial'
  | 'stale'
  | 'satisfied';

export interface ViewPage {
  items: ViewItemDescriptor[];
  prevCursor: unknown;
  nextCursor: unknown;
  hasMoreForward: boolean;
  hasMoreBackward: boolean;
}

export interface ViewState {
  viewKey: string;
  pages: ViewPage[];
  status: ViewStatus;
  error: ViewError | null;
  satisfactionStatus: SatisfactionStatus;
  updatedAt: number;
  dependencyTokens?: string[];
  diagnostics?: {
    forwardExtensions: number;
    backwardExtensions: number;
    trimmedHeadPages: number;
    trimmedTailPages: number;
    lastIntent: 'resolve' | 'forward' | 'backward';
  };
}

export class ViewStoreClient {
  private views = new Map<string, ViewState>();
  /** Monotonic per-view revisions reject a response started before an eviction. */
  private revisions = new Map<string, number>();
  private subscribers = new Map<string, Set<(view: ViewState | null) => void>>();
  private referenceIndex = new Map<string, Set<string>>();
  private dependencyIndex = new Map<string, Set<string>>();

  private referenceKey(reference: Pick<CacheRecordReference, 'namespace' | 'id'>): string {
    return `${reference.namespace}\u0000${reference.id}`;
  }

  private updateIndex(index: Map<string, Set<string>>, key: string, viewKey: string, add: boolean): void {
    if (add) {
      const viewKeys = index.get(key) ?? new Set<string>();
      viewKeys.add(viewKey);
      index.set(key, viewKeys);
      return;
    }
    const viewKeys = index.get(key);
    viewKeys?.delete(viewKey);
    if (viewKeys?.size === 0) index.delete(key);
  }

  private indexView(state: ViewState, add: boolean): void {
    for (const item of flattenViewPages(state)) {
      if (item.type !== 'row') continue;
      for (const reference of getViewRowReferences(item)) {
        this.updateIndex(this.referenceIndex, this.referenceKey(reference), state.viewKey, add);
      }
    }
    for (const token of state.dependencyTokens ?? []) {
      this.updateIndex(this.dependencyIndex, token, state.viewKey, add);
    }
  }

  public get(viewKey: string): ViewState | null {
    return this.views.get(viewKey) || null;
  }

  public getRevision(viewKey: string): number {
    return this.revisions.get(viewKey) ?? 0;
  }

  public set(viewKey: string, state: ViewState): void {
    const previous = this.views.get(viewKey);
    if (previous) this.indexView(previous, false);
    this.views.set(viewKey, state);
    this.indexView(state, true);
    this.notifySubscribers(viewKey);
  }

  public delete(viewKey: string): void {
    const previous = this.views.get(viewKey);
    if (previous) {
      this.revisions.set(viewKey, this.getRevision(viewKey) + 1);
    }
    if (previous) this.indexView(previous, false);
    this.views.delete(viewKey);
    this.notifySubscribers(viewKey);
  }

  public getKeys(): string[] {
    return Array.from(this.views.keys());
  }

  public invalidateDependency(token: string): void {
    for (const viewKey of [...(this.dependencyIndex.get(token) ?? [])]) this.delete(viewKey);
  }

  public invalidateReference(reference: Pick<CacheRecordReference, 'namespace' | 'id'>): void {
    for (const viewKey of [...(this.referenceIndex.get(this.referenceKey(reference)) ?? [])]) {
      this.delete(viewKey);
    }
  }

  public invalidateNamespace(namespace: CacheRecordNamespace): void {
    const prefix = `${namespace}\u0000`;
    const viewKeys = new Set<string>();
    for (const [referenceKey, referencedViewKeys] of this.referenceIndex) {
      if (!referenceKey.startsWith(prefix)) continue;
      referencedViewKeys.forEach((viewKey) => viewKeys.add(viewKey));
    }
    viewKeys.forEach((viewKey) => this.delete(viewKey));
  }

  public invalidateNamespacePrefix(namespacePrefix: string): void {
    const viewKeys = new Set<string>();
    for (const [referenceKey, referencedViewKeys] of this.referenceIndex) {
      if (!referenceKey.startsWith(namespacePrefix)) continue;
      referencedViewKeys.forEach((viewKey) => viewKeys.add(viewKey));
    }
    viewKeys.forEach((viewKey) => this.delete(viewKey));
  }

  public purge(): void {
    const keys = this.getKeys();
    keys.forEach((viewKey) => this.revisions.set(viewKey, this.getRevision(viewKey) + 1));
    this.views.clear();
    this.referenceIndex.clear();
    this.dependencyIndex.clear();
    keys.forEach((viewKey) => this.notifySubscribers(viewKey));
  }

  public subscribe(viewKey: string, callback: (view: ViewState | null) => void): () => void {
    if (!this.subscribers.has(viewKey)) {
      this.subscribers.set(viewKey, new Set());
    }
    this.subscribers.get(viewKey)!.add(callback);
    
    // Invia immediatamente lo stato corrente
    callback(this.get(viewKey));

    return () => {
      const subs = this.subscribers.get(viewKey);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(viewKey);
        }
      }
    };
  }

  private notifySubscribers(viewKey: string) {
    const view = this.get(viewKey);
    const subs = this.subscribers.get(viewKey);
    if (subs) {
      subs.forEach((cb) => cb(view));
    }
  }
}

export const GlobalViewStore = new ViewStoreClient();

// --- PURE SELECTORS --- //

export function flattenViewPages(state: ViewState | null): ViewItemDescriptor[] {
  if (!state || !state.pages) return [];
  return state.pages.flatMap(p => p.items);
}

export function getViewItemKey(item: ViewItemDescriptor): string {
  return item.type === 'row'
    ? `row:${item.reference.namespace}:${item.reference.id}`
    : `group:${item.groupId}`;
}

export function getViewRowReferences(
  item: Extract<ViewItemDescriptor, { type: 'row' }>,
): CacheRecordReference[] {
  return [item.reference, ...(item.requires ?? [])];
}

export function getViewHasMoreForward(state: ViewState | null): boolean {
  if (!state || state.pages.length === 0) return false;
  return state.pages[state.pages.length - 1].hasMoreForward;
}

export function getViewHasMoreBackward(state: ViewState | null): boolean {
  if (!state || state.pages.length === 0) return false;
  return state.pages[0].hasMoreBackward;
}

export function getViewNextCursor(state: ViewState | null): unknown {
  if (!state || state.pages.length === 0) return undefined;
  return state.pages[state.pages.length - 1].nextCursor;
}

export function getViewPrevCursor(state: ViewState | null): unknown {
  if (!state || state.pages.length === 0) return undefined;
  return state.pages[0].prevCursor;
}
