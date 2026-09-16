"use client";

import { useCallback, useMemo } from "react";
import { useAdminModuleState } from "./useAdminModuleState";
import { ADMIN_PAGE_SIZE } from "./AdminPaginationPolicy";

/**
 * Keeps the query cursor for a server-paged administrative collection.
 *
 * This deliberately has no visible range: remote collections receive their
 * rows already bounded by the backend and must never derive a client page.
 */
export function useAdminRemotePagination({
  total,
  stateKey,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  total: number;
  stateKey: string;
  pageSize?: number;
}) {
  const defaults = useMemo(() => ({ page: 1 }), []);
  const [persisted, updatePersisted] = useAdminModuleState(
    `pagination.${stateKey}`,
    defaults,
  );
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, persisted.page), pageCount);
  const setPage = useCallback((nextPage: number) => updatePersisted({
    page: Math.max(1, Math.min(Math.trunc(nextPage), pageCount)),
  }), [pageCount, updatePersisted]);
  const reset = useCallback(() => setPage(1), [setPage]);

  return {
    page,
    pageCount,
    pageSize,
    setPage,
    reset,
  };
}
