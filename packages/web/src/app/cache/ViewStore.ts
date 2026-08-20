export type ViewItemDescriptor = 
  | { type: 'row'; id: string; entityTypeId?: string }
  | { type: 'group'; groupId: string; label: string };

export type ViewStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ViewError {
  code: string;
  message: string;
  timestamp: number;
}

export type SatisfactionStatus = 
  | 'missing-view'
  | 'missing-entities'
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
  private subscribers = new Map<string, Set<(view: ViewState | null) => void>>();

  public get(viewKey: string): ViewState | null {
    return this.views.get(viewKey) || null;
  }

  public set(viewKey: string, state: ViewState): void {
    this.views.set(viewKey, state);
    this.notifySubscribers(viewKey);
  }

  public delete(viewKey: string): void {
    this.views.delete(viewKey);
    this.notifySubscribers(viewKey);
  }

  public getKeys(): string[] {
    return Array.from(this.views.keys());
  }

  public purge(): void {
    const keys = this.getKeys();
    this.views.clear();
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
