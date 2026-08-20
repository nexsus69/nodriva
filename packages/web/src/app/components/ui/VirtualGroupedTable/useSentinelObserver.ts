import { useEffect, useRef, useCallback, useState, RefObject } from 'react';
import { SentinelTriggerGate } from './sentinelTriggerGate';
import { bindSentinelObserver } from './sentinelObserverBinding';

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
  const triggerGateRef = useRef(new SentinelTriggerGate(DEBOUNCE_MS));
  const [topTriggerCount, setTopTriggerCount] = useState<number>(0);
  const [bottomTriggerCount, setBottomTriggerCount] = useState<number>(0);
  const [lastTriggered, setLastTriggered] = useState<'top' | 'bottom' | null>(null);
  const [lastTriggerTime, setLastTriggerTime] = useState<string | null>(null);

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

  useEffect(() => {
    const container = containerRef.current;
    const topEl = topSentinelRef.current;
    const bottomEl = bottomSentinelRef.current;
    if (!container || !topEl || !bottomEl) return;

    const disconnect = bindSentinelObserver(container, topEl, bottomEl,
      (entries) => {
        const now = Date.now();

        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          if (entry.target === bottomEl) {
            if (!triggerGateRef.current.tryTrigger('forward', now, {
              hasMore: hasMoreForwardRef.current,
              canLoadMore: canLoadMoreForwardRef.current,
              isLoading: isLoadingForwardRef.current,
            })) continue;

            onBeforeFetchRef.current?.('forward');
            setBottomTriggerCount((prev) => prev + 1);
            setLastTriggered('bottom');
            setLastTriggerTime(new Date().toLocaleTimeString());
            onLoadMoreForwardRef.current?.();
          }

          if (entry.target === topEl) {
            if (!triggerGateRef.current.tryTrigger('backward', now, {
              hasMore: hasMoreBackwardRef.current,
              canLoadMore: canLoadMoreBackwardRef.current,
              isLoading: isLoadingBackwardRef.current,
            })) continue;

            onBeforeFetchRef.current?.('backward');
            setTopTriggerCount((prev) => prev + 1);
            setLastTriggered('top');
            setLastTriggerTime(new Date().toLocaleTimeString());
            onLoadMoreBackwardRef.current?.();
          }
        }
      },
    );
    return () => {
      disconnect();
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
