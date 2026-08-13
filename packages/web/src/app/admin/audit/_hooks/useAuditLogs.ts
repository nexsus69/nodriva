'use client';

import { useCallback, useEffect, useState, useTransition, type FormEvent } from 'react';
import type { ApiErrorResponse, AuditLogFilterDto, AuditLogListItemDto, PaginatedResultDto } from '@dashboard/core';
import { AppCache } from '../../../cache/GlobalCacheClient';

export type AuditFilterForm = { actionKey: string; resourceKind: string; actorUserId: string; resourceId: string; fromDate: string; toDate: string };
const EMPTY_FILTERS: AuditFilterForm = { actionKey: '', resourceKind: '', actorUserId: '', resourceId: '', fromDate: '', toDate: '' };

const toQuery = (filters: AuditFilterForm, page: number): AuditLogFilterDto => ({
  page,
  pageSize: 20,
  actionKey: filters.actionKey || undefined,
  resourceKind: filters.resourceKind || undefined,
  actorUserId: filters.actorUserId || undefined,
  resourceId: filters.resourceId || undefined,
  fromDate: filters.fromDate ? new Date(filters.fromDate).toISOString() : undefined,
  toDate: filters.toDate ? new Date(filters.toDate).toISOString() : undefined,
});

export function useAuditLogs() {
  const [data, setData] = useState<PaginatedResultDto<AuditLogListItemDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [filters, setFilters] = useState<AuditFilterForm>(EMPTY_FILTERS);
  const [isPending, startTransition] = useTransition();

  const loadPage = useCallback((page: number, selectedFilters: AuditFilterForm) => {
    setLoading(true); setError(null);
    startTransition(async () => {
      const result = await AppCache.admin.listAuditLogs(toQuery(selectedFilters, page));
      if (result.success && result.data) setData(result.data);
      else if (result.error) setError(result.error);
      setLoading(false);
    });
  }, []);

  const fetchLogs = useCallback((page = 1) => loadPage(page, filters), [filters, loadPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadPage(1, EMPTY_FILTERS), 0);
    return () => window.clearTimeout(timer);
  }, [loadPage]);

  const search = useCallback((event: FormEvent) => { event.preventDefault(); fetchLogs(1); }, [fetchLogs]);
  const reset = useCallback(() => { setFilters(EMPTY_FILTERS); loadPage(1, EMPTY_FILTERS); }, [loadPage]);

  return { data, loading, error, filters, setFilters, isPending, fetchLogs, search, reset };
}
