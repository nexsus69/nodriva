"use client";

/** Presents an authorized, compact audit feed without duplicating audit-query behavior. */
import type { AuditLogListItemDto } from "@dashboard/core";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { formatAdminDateTime } from "@/adminPanel/adminFormatters";
import { AdminTechnicalIdentifier } from "@/adminPanel/components/AdminTechnicalIdentifier";
import { AdminDashboardCard } from "@/adminPanel/components/AdminDashboardCard";
import { AdminDashboardReadState } from "@/adminPanel/components/AdminDashboardReadState";
import { auditSemanticOption } from "../activity/_components/auditSemanticCatalog";
import type { AdminOverviewRead } from "./useAdminOverview";

export function AdminOverviewRecentActivitySection({
  auditRecords,
}: {
  auditRecords: AdminOverviewRead<AuditLogListItemDto>;
}) {
  const { locale, t } = useAppLocale();
  return (
    <AdminDashboardCard title={t("admin.overviewRecentActivity")} description={t("admin.overviewRecentActivityDescription")} icon="activity" href="/admin/governance/audit">
      <AdminDashboardReadState state={auditRecords.state} error={auditRecords.error} unavailableLabel={t("admin.overviewUnavailable")}>
        {auditRecords.data.length === 0 ? (
          <p className="text-sm text-slate-500">{t("admin.overviewNoRecentActivity")}</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {auditRecords.data.map((record) => (
              <li key={record.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 text-sm"><p className="font-medium text-slate-900">{auditSemanticOption(record.actionKey, "action", t).label}</p><p className="mt-0.5 truncate text-xs text-slate-500">{record.resourceLabel ?? auditSemanticOption(record.resourceKind, "resource", t).label} · {record.actorEmail ?? record.actorUserId ?? "—"} · {formatAdminDateTime(record.createdAt, locale)}</p></div>
                <AdminTechnicalIdentifier value={record.resourceId} />
              </li>
            ))}
          </ol>
        )}
      </AdminDashboardReadState>
    </AdminDashboardCard>
  );
}
