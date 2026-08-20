import { GlobalViewStore, type ViewState } from './ViewStore';

/**
 * Keeps the immediate subscription snapshot separate from later invalidations.
 * ViewStore subscriptions synchronously emit once, so an initial cache miss is
 * handled by the caller's first resolve while every subsequent eviction must
 * trigger a new authoritative resolve.
 */
export function subscribeSemanticViewState(
  viewKey: string,
  onState: (state: ViewState | null) => void,
  onInvalidated: () => void,
): () => void {
  let initialNotification = true;
  return GlobalViewStore.subscribe(viewKey, (state) => {
    onState(state);
    if (state === null && !initialNotification) onInvalidated();
    initialNotification = false;
  });
}
