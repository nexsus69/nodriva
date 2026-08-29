"use client";

/** Composes the audit filters, results, and immutable detail surface. */
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import type { AuditLogListItemDto } from "@dashboard/core";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { AuditFilterPanel } from "./AuditFilterPanel";
import { AuditLogDetailDrawer } from "./AuditLogDetailDrawer";
import { auditSemanticOption } from "./auditSemanticCatalog";
import { useAuditLog } from "./useAuditLog";

export function AuditModuleScreen() {
  const { t } = useAppLocale();
  const audit = useAuditLog(t);
  const definition: AdminCollectionDefinition<AuditLogListItemDto> = {
    title: t("admin.auditLog"),
    description: t("admin.auditDescription"),
    icon: "activity",
    breadcrumbs: [{ label: t("admin.activity") }],
    columns: [
      { key: "action", label: t("admin.action"), render: (row) => auditSemanticOption(row.actionKey, "action", t).label, sortValue: (row) => row.actionKey },
      { key: "resource", label: t("admin.resourceKind"), render: (row) => `${auditSemanticOption(row.resourceKind, "resource", t).label}: ${row.resourceId}` },
      { key: "actor", label: t("admin.actor"), render: (row) => row.actorEmail ?? row.actorUserId ?? "—" },
      { key: "createdAt", label: t("admin.createdAt"), render: (row) => row.createdAt },
    ],
    emptyLabel: t("admin.noRecords"),
    loadingLabel: t("admin.loadingAudit"),
    error: audit.error,
    loading: audit.loading,
    rows: audit.rows,
    filterPanel: <AuditFilterPanel t={t} users={audit.users} catalog={audit.catalog} values={audit.filters} onChange={audit.setFilters} onApply={audit.applyFilters} onClear={audit.clearFilters} />,
    refreshLabel: t("admin.refresh"),
    onRefresh: audit.refresh,
    onOpen: audit.openDetail,
    rowLabel: (row) => `${row.actionKey} · ${row.resourceKind}`,
    actionMenuLabel: t("admin.actions"),
    pagination: { mode: "remote", page: audit.pagination.page, pageCount: audit.pagination.pageCount, onPageChange: audit.loadPage },
  };
  return (
    <>
      <AdminCollectionScreen definition={definition} />
      {audit.selected && <AuditLogDetailDrawer detail={audit.selected} t={t} onClose={audit.closeDetail} />}
    </>
  );
}
