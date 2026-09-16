"use client";

import { useMemo, useState } from "react";
import { useAdminModuleState } from "./useAdminModuleState";
import { ADMIN_PAGE_SIZE } from "./AdminPaginationPolicy";

/** Defines the one pagination policy shared by every administrative collection. */
export { ADMIN_PAGE_SIZE } from "./AdminPaginationPolicy";

/** Owns page selection, clamping, and visible-window calculation for any list. */
export function useAdminPagination({
  total,
  pageSize = ADMIN_PAGE_SIZE,
  stateKey,
}: {
  total: number;
  pageSize?: number;
  stateKey?: string;
}) {
  const [localPage, setLocalPage] = useState(1);
  const paginationDefaults = useMemo(() => ({ page: 1 }), []);
  const [persisted, updatePersisted] = useAdminModuleState(
    stateKey ? `pagination.${stateKey}` : "pagination.transient",
    paginationDefaults,
  );
  const selectedPage = stateKey ? persisted.page : localPage;
  const setSelectedPage = stateKey
    ? (page: number) => updatePersisted({ page })
    : setLocalPage;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(selectedPage, pageCount);

  const visibleRange = useMemo(
    () => ({
      start: (page - 1) * pageSize,
      end: page * pageSize,
    }),
    [page, pageSize],
  );

  return {
    page,
    pageCount,
    pageSize,
    setPage: setSelectedPage,
    reset: () => setSelectedPage(1),
    visibleRange,
  };
}
