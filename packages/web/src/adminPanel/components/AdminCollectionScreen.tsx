"use client";

/** Renders a definition-driven administrative collection with one shared lifecycle. */
import type { ReactNode } from "react";
import { Alert, EmptyState, Skeleton, SkeletonState } from "@/app/components/ui/feedback";
import { AdminTable, type AdminTableAction, type AdminTableColumn } from "./AdminTable";
import { AdminPagination } from "./AdminPagination";
import { useAdminPagination } from "../useAdminPagination";

export interface AdminCollectionDefinition<TRow extends { id: string }> {
  title: string;
  description: string;
  createLabel?: string;
  columns: readonly AdminTableColumn<TRow>[];
  actions?: readonly AdminTableAction<TRow>[];
  emptyLabel: string;
  loadingLabel: string;
  error: Error | null;
  loading: boolean;
  rows: readonly TRow[];
  toolbar?: ReactNode;
  onCreate?: () => void;
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
  const pagination = useAdminPagination({
    total: definition.rows.length,
    pageSize: definition.pagination?.pageSize,
    stateKey: definition.pagination?.stateKey,
  });
  const visibleRows = definition.rows.slice(
    pagination.visibleRange.start,
    pagination.visibleRange.end,
  );
  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Nodriva Admin Panel
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {definition.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            {definition.description}
          </p>
        </div>
        {definition.onCreate && definition.createLabel && (
          <button
            type="button"
            onClick={definition.onCreate}
            className="bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + {definition.createLabel}
          </button>
        )}
      </header>
      {definition.toolbar}
      {definition.error && (
        <Alert tone="danger">{definition.error.message}</Alert>
      )}
      {definition.loading && definition.rows.length === 0 ? (
        <SkeletonState label={definition.loadingLabel} className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="border border-slate-200 bg-white p-5">
              <Skeleton className="h-3 w-1/3" />
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
