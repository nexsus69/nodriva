import { useEffect, useRef, useCallback, useState, RefObject } from 'react';

export interface UseSentinelObserverOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  topSentinelRef: RefObject<HTMLDivElement | null>;
  bottomSentinelRef: RefObject<HTMLDivElement | null>;
  hasMoreForward: boolean;
  hasMoreBackward: boolean;
  isLoadingMoreForward: boolean;
  isLoadingMoreBackward: boolean;
  onLoadMoreForward?: () => void;
  onLoadMoreBackward?: () => void;
  onBeforeFetch?: (direction: 'forward' | 'backward') => void;
  canLoadMoreForward?: boolean;
  canLoadMoreBackward?: boolean;
}

const DEBOUNCE_MS = 200;

export function useSentinelObserver({
  containerRef,
  topSentinelRef,
  bottomSentinelRef,
  hasMoreForward,
  hasMoreBackward,
  isLoadingMoreForward,
  isLoadingMoreBackward,
  onLoadMoreForward,
  onLoadMoreBackward,
  onBeforeFetch,
  canLoadMoreForward = true,
  canLoadMoreBackward = true,
}: UseSentinelObserverOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ─── Debounce temporale per direzione ──────────────────────────────────────
  // Sostituisce la macchina a stati Armato/Disarmato.
  // Puramente sincrono (ref + Date.now), zero dipendenze da React lifecycle.
  const lastForwardTriggerRef = useRef<number>(0);
  const lastBackwardTriggerRef = useRef<number>(0);

  // ─── Conteggi e Stato Debug ───────────────────────────────────────────────
  const [topTriggerCount, setTopTriggerCount] = useState<number>(0);
  const [bottomTriggerCount, setBottomTriggerCount] = useState<number>(0);
  const [lastTriggered, setLastTriggered] = useState<'top' | 'bottom' | null>(null);
  const [lastTriggerTime, setLastTriggerTime] = useState<string | null>(null);

  // ─── Refs stabili per evitare stale closure nell'observer ──────────────────
  const hasMoreForwardRef = useRef(hasMoreForward);
  const hasMoreBackwardRef = useRef(hasMoreBackward);
  const canLoadMoreForwardRef = useRef(canLoadMoreForward);
  const canLoadMoreBackwardRef = useRef(canLoadMoreBackward);
  const isLoadingForwardRef = useRef(isLoadingMoreForward);
  const isLoadingBackwardRef = useRef(isLoadingMoreBackward);
  const onLoadMoreForwardRef = useRef(onLoadMoreForward);
  const onLoadMoreBackwardRef = useRef(onLoadMoreBackward);
  const onBeforeFetchRef = useRef(onBeforeFetch);

  useEffect(() => {
    hasMoreForwardRef.current = hasMoreForward;
    hasMoreBackwardRef.current = hasMoreBackward;
    canLoadMoreForwardRef.current = canLoadMoreForward;
    canLoadMoreBackwardRef.current = canLoadMoreBackward;
    isLoadingForwardRef.current = isLoadingMoreForward;
    isLoadingBackwardRef.current = isLoadingMoreBackward;
    onLoadMoreForwardRef.current = onLoadMoreForward;
    onLoadMoreBackwardRef.current = onLoadMoreBackward;
    onBeforeFetchRef.current = onBeforeFetch;
  }, [
    hasMoreForward,
    hasMoreBackward,
    canLoadMoreForward,
    canLoadMoreBackward,
    isLoadingMoreForward,
    isLoadingMoreBackward,
    onLoadMoreForward,
    onLoadMoreBackward,
    onBeforeFetch,
  ]);

  // ─── Setup dell'IntersectionObserver 100% Nativo e Pulito ──────────────
  useEffect(() => {
    const container = containerRef.current;
    const topEl = topSentinelRef.current;
    const bottomEl = bottomSentinelRef.current;
    if (!container || !topEl || !bottomEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const now = Date.now();

        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          // Sentinel Bottom (Forward Scroll)
          if (entry.target === bottomEl) {
            if (now - lastForwardTriggerRef.current < DEBOUNCE_MS) continue;
            if (!hasMoreForwardRef.current || !canLoadMoreForwardRef.current || isLoadingForwardRef.current) continue;

            lastForwardTriggerRef.current = now;
            onBeforeFetchRef.current?.('forward');
            setBottomTriggerCount((prev) => prev + 1);
            setLastTriggered('bottom');
            setLastTriggerTime(new Date().toLocaleTimeString());
            onLoadMoreForwardRef.current?.();
          }

          // Sentinel Top (Backward Scroll)
          if (entry.target === topEl) {
            if (now - lastBackwardTriggerRef.current < DEBOUNCE_MS) continue;
            if (!hasMoreBackwardRef.current || !canLoadMoreBackwardRef.current || isLoadingBackwardRef.current) continue;

            lastBackwardTriggerRef.current = now;
            onBeforeFetchRef.current?.('backward');
            setTopTriggerCount((prev) => prev + 1);
            setLastTriggered('top');
            setLastTriggerTime(new Date().toLocaleTimeString());
            onLoadMoreBackwardRef.current?.();
          }
        }
      },
      { root: container, threshold: 0.01 }
    );

    observer.observe(topEl);
    observer.observe(bottomEl);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [containerRef, topSentinelRef, bottomSentinelRef]);

  const resetDebugCounts = useCallback(() => {
    setTopTriggerCount(0);
    setBottomTriggerCount(0);
    setLastTriggered(null);
    setLastTriggerTime(null);
  }, []);

  return {
    topTriggerCount,
    bottomTriggerCount,
    lastTriggered,
    lastTriggerTime,
    resetDebugCounts,
  };
}
