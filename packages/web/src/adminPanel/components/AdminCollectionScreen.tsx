"use client";

/** Renders a definition-driven administrative collection with one shared lifecycle. */
import { useMemo, useState, type ReactNode } from "react";
import { Alert, EmptyState, Skeleton, SkeletonState } from "@/app/components/ui/feedback";
import {
  AdminTable,
  sortAdminRows,
  type AdminTableAction,
  type AdminTableColumn,
  type AdminTableSortState,
} from "./AdminTable";
import { AdminPagination } from "./AdminPagination";
import { useAdminPagination } from "../useAdminPagination";
import { AdminButton } from "./AdminButton";
import { AdminPageHeader, type AdminBreadcrumbItem } from "./AdminPageHeader";
import { AdminToolbar } from "./AdminToolbar";

export interface AdminCollectionDefinition<TRow extends { id: string }> {
  title: string;
  description: string;
  icon?: string;
  breadcrumbs?: readonly AdminBreadcrumbItem[];
  createLabel?: string;
  columns: readonly AdminTableColumn<TRow>[];
  actions?: readonly AdminTableAction<TRow>[];
  emptyLabel: string;
  loadingLabel: string;
  error: Error | null;
  loading: boolean;
  rows: readonly TRow[];
  toolbar?: ReactNode;
  search?: {
    value: string;
    label: string;
    placeholder: string;
    onChange: (value: string) => void;
  };
  resultLabel?: ReactNode;
  refreshLabel?: string;
  onRefresh?: () => void;
  onCreate?: () => void;
  onOpen?: (row: TRow) => void;
  rowLabel?: (row: TRow) => string;
  actionMenuLabel?: string;
  selectedRowId?: string;
  /** Configures the shared client-side page window for collection rows. */
  pagination?: {
    stateKey?: string;
    pageSize?: number;
    previousLabel?: string;
    nextLabel?: string;
    pageLabel?: (page: number, pageCount: number) => string;
  };
}

/** Presents any admin collection while keeping loading and error behavior consistent. */
export function AdminCollectionScreen<TRow extends { id: string }>(
  { definition }: { definition: AdminCollectionDefinition<TRow> },
) {
  const [sort, setSort] = useState<AdminTableSortState | null>(null);
  const sortedRows = useMemo(() => {
    return sortAdminRows(definition.rows, definition.columns, sort);
  }, [definition.columns, definition.rows, sort]);
  const pagination = useAdminPagination({
    total: sortedRows.length,
    pageSize: definition.pagination?.pageSize,
    stateKey: definition.pagination?.stateKey,
  });
  const visibleRows = sortedRows.slice(
    pagination.visibleRange.start,
    pagination.visibleRange.end,
  );
  return (
    <section className="space-y-6">
      <AdminPageHeader
        title={definition.title}
        description={definition.description}
        icon={definition.icon}
        breadcrumbs={definition.breadcrumbs}
        actions={definition.onCreate && definition.createLabel ? (
          <AdminButton tone="primary" icon="plus" onClick={definition.onCreate}>
            {definition.createLabel}
          </AdminButton>
        ) : undefined}
      />
      {(definition.toolbar || definition.search || definition.resultLabel || definition.onRefresh) && (
        <AdminToolbar
          search={definition.search}
          meta={definition.resultLabel}
          refreshLabel={definition.refreshLabel}
          onRefresh={definition.onRefresh}
        >
          {definition.toolbar}
        </AdminToolbar>
      )}
      {definition.error && (
        <Alert tone="danger">{definition.error.message}</Alert>
      )}
      {definition.loading && definition.rows.length === 0 ? (
        <SkeletonState
          label={definition.loadingLabel}
          className="overflow-hidden border border-slate-200 bg-white"
        >
          <div className="flex gap-8 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex gap-8 border-b border-slate-100 px-4 py-4 last:border-0">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </SkeletonState>
      ) : definition.error ? null : definition.rows.length === 0 ? (
        <EmptyState
          title={definition.emptyLabel}
          description={definition.description}
        />
      ) : (
        <AdminTable
          rows={visibleRows}
          columns={definition.columns}
          actions={definition.actions}
          emptyLabel={definition.emptyLabel}
          onOpen={definition.onOpen}
          rowLabel={definition.rowLabel}
          actionMenuLabel={definition.actionMenuLabel}
          selectedRowId={definition.selectedRowId}
          sort={sort}
          onSortChange={setSort}
        />
      )}
      {definition.loading && definition.rows.length > 0 && <p className="text-xs text-slate-400" aria-live="polite">{definition.loadingLabel}…</p>}
      {!definition.loading &&
        !definition.error &&
        definition.rows.length > pagination.pageSize && (
          <AdminPagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            onPageChange={pagination.setPage}
          />
        )}
    </section>
  );
}
