"use client";

/** Connects an active admin collection to semantic realtime invalidations. */
import { useEffect, useRef } from "react";
import { AppCache } from "@/app/cache/GlobalCacheClient";

export function matchesAdminRealtimeInvalidation(
  dependencies: readonly string[],
  invalidated: readonly string[],
): boolean {
  return dependencies.some((dependency) => invalidated.some(
    (key) => key === dependency || key.startsWith(`${dependency}:`) || dependency.startsWith(`${key}:`),
  ));
}

/**
 * Reloads only an affected visible collection, coalescing event bursts and
 * postponing network work while the browser is in the background.
 */
export function useAdminRealtimeCollectionRefresh(
  dependencies: readonly string[] | undefined,
  reload: () => Promise<void>,
): void {
  const reloadRef = useRef(reload);
  const timerRef = useRef<number | null>(null);
  const staleRef = useRef(false);
  useEffect(() => { reloadRef.current = reload; }, [reload]);

  useEffect(() => {
    if (!dependencies?.length) return undefined;
    const schedule = () => {
      if (document.visibilityState !== "visible") {
        staleRef.current = true;
        return;
      }
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void reloadRef.current();
      }, 100);
    };
    const unsubscribe = AppCache.subscribeAdminRealtimeInvalidations((keys) => {
      if (matchesAdminRealtimeInvalidation(dependencies, keys)) schedule();
    });
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && staleRef.current) {
        staleRef.current = false;
        schedule();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [dependencies]);
}
