/** Owns the remote, ACL-authoritative paging lifecycle for administrative content catalogues. */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminContentCatalogSortKey } from '@dashboard/core';
import { AppCache } from '@/app/cache/GlobalCacheClient';
import { useAdminRemotePagination } from '@/adminPanel/useAdminRemotePagination';
import { useAdminRealtimeCollectionRefresh } from '@/adminPanel/useAdminRealtimeCollectionRefresh';
import type { AdminTableSortState } from '@/adminPanel/components/AdminTable';
import type { AdminEntityCatalogItem, AdminNodeCatalogItem } from '@dashboard/core';

type Kind = 'node' | 'entity';
type Row = AdminNodeCatalogItem | AdminEntityCatalogItem;

export function useAdminContentCatalogue(kind: Kind, search: string, sort: AdminTableSortState | null) {
  const [rows, setRows] = useState<readonly Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestVersion = useRef(0);
  const pagination = useAdminRemotePagination({ total, stateKey: `content.${kind}` });
  const load = useCallback(async (requestedPage: number) => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const acceptedSort = sort && ['path', 'name', 'type'].includes(sort.columnKey)
        ? { key: sort.columnKey as AdminContentCatalogSortKey, direction: sort.direction }
        : undefined;
      const input = { page: requestedPage, pageSize: pagination.pageSize, search: search.trim() || undefined, sort: acceptedSort };
      const result = kind === 'node'
        ? await AppCache.admin.listAdminNodesPage(input)
        : await AppCache.adminEntities.read(input);
      if (version !== requestVersion.current) return;
      setRows(result.items as readonly Row[]);
      setTotal(result.total);
      pagination.setPage(result.page);
      setError(null);
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [kind, pagination, search, sort]);
  useEffect(() => {
    // Defer the query transition until after React has committed the new
    // search/sort inputs; both state changes are then one remote transition.
    void Promise.resolve().then(() => {
      pagination.reset();
      return load(1);
    });
    // Search and server sort define a new query identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, search, sort]);
  useAdminRealtimeCollectionRefresh(kind === 'node' ? ['children'] : ['admin-entities-page'], () => load(pagination.page));
  return {
    rows, total, loading, error, pagination,
    loadPage: (page: number) => void load(page),
    refresh: () => {
      if (kind === 'entity') AppCache.adminEntities.invalidateFamily();
      void load(pagination.page);
    },
  };
}
