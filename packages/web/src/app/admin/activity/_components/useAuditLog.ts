"use client";

/** Owns the filtered, server-paged audit-query lifecycle outside its screen. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AuditFilterCatalogDto,
  AuditLogDetailDto,
  AuditLogListItemDto,
  UserListItemDto,
} from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { useAdminModuleState } from "@/adminPanel/useAdminModuleState";
import { useAdminPagination } from "@/adminPanel/useAdminPagination";
import { refreshAdminCollection } from "@/adminPanel/refreshAdminCollection";
import { useAdminRealtimeCollectionRefresh } from "@/adminPanel/useAdminRealtimeCollectionRefresh";
import { toAuditFilterQuery, type AuditFilterForm } from "./auditFilterModel";

type Translate = (key: string, fallback?: string) => string;
const AUDIT_REALTIME_DEPENDENCIES = ["audit"] as const;

/** Keeps filter state, remote pagination, selection, and authoritative reloads coherent. */
export function useAuditLog(t: Translate) {
  const [users, setUsers] = useState<readonly UserListItemDto[]>([]);
  const [catalog, setCatalog] = useState<AuditFilterCatalogDto | null>(null);
  const [rows, setRows] = useState<AuditLogListItemDto[]>([]);
  const [selected, setSelected] = useState<AuditLogDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const requestVersion = useRef(0);
  const moduleDefaults = useMemo(
    () => ({ filters: {} as AuditFilterForm, selectedAuditId: "" }),
    [],
  );
  const [moduleState, updateModuleState] = useAdminModuleState(
    "governance.audit",
    moduleDefaults,
  );
  const filters = moduleState.filters;
  const pagination = useAdminPagination({ total, stateKey: "governance.audit" });

  const load = useCallback(async (
    next: AuditFilterForm = filters,
    requestedPage = pagination.page,
  ) => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const query = toAuditFilterQuery(next, requestedPage, pagination.pageSize);
      const result = await AppCache.admin.listAuditLogs(query);
      if (!result.success || !result.data) throw new Error(result.error?.message ?? t("admin.loadingAudit"));
      if (version !== requestVersion.current) return;
      setRows(result.data.items);
      setTotal(result.data.total);
      pagination.setPage(result.data.page);
      setError(null);
    } catch (cause) {
      if (version !== requestVersion.current) return;
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [filters, pagination, t]);

  useEffect(() => {
    void AppCache.users.listUsers().then(setUsers).catch(() => undefined);
    void AppCache.admin.listAuditFilterCatalog().then((result) => {
      if (result.success && result.data) setCatalog(result.data);
      else setError(new Error(result.error?.message ?? t("admin.auditCatalogUnavailable")));
    });
    void Promise.resolve().then(() => load());
    // Initial loading intentionally runs once; subsequent reads are explicit transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!moduleState.selectedAuditId) return;
    void AppCache.admin.getAuditLogById(moduleState.selectedAuditId).then((result) => {
      if (result.success && result.data) setSelected(result.data);
    });
  }, [moduleState.selectedAuditId]);

  const applyFilters = useCallback(() => {
    pagination.reset();
    void load(filters, 1);
  }, [filters, load, pagination]);
  const clearFilters = useCallback(() => {
    updateModuleState({ filters: {} });
    pagination.reset();
    void load({}, 1);
  }, [load, pagination, updateModuleState]);
  const openDetail = useCallback((row: AuditLogListItemDto) => {
    updateModuleState({ selectedAuditId: row.id });
  }, [updateModuleState]);
  useAdminRealtimeCollectionRefresh(
    AUDIT_REALTIME_DEPENDENCIES,
    () => load(filters, pagination.page),
  );

  return {
    users,
    catalog,
    rows,
    loading,
    error,
    filters,
    pagination,
    selected: moduleState.selectedAuditId === selected?.id ? selected : null,
    setFilters: (next: AuditFilterForm) => updateModuleState({ filters: next }),
    applyFilters,
    clearFilters,
    openDetail,
    closeDetail: () => updateModuleState({ selectedAuditId: "" }),
    loadPage: (page: number) => void load(filters, page),
    refresh: () => void refreshAdminCollection(() => load(filters, pagination.page)),
  };
}
