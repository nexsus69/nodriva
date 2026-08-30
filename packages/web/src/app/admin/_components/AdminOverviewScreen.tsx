"use client";

/** Composes the administrative dashboard from independently reusable sections. */
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminButton } from "@/adminPanel/components/AdminButton";
import { AdminDashboardMetricCard } from "@/adminPanel/components/AdminDashboardMetricCard";
import { AdminPageHeader } from "@/adminPanel/components/AdminPageHeader";
import { AdminOverviewAttentionSection } from "./AdminOverviewAttentionSection";
import { AdminOverviewRecentActivitySection } from "./AdminOverviewRecentActivitySection";
import { summarizeAdminOverview } from "./adminOverviewModel";
import { useAdminOverview } from "./useAdminOverview";

/** Uses the read-model controller and composes the dashboard without owning effects or calculations. */
export function AdminOverviewScreen() {
  const { t } = useAppLocale();
  const overview = useAdminOverview();
  const summary = summarizeAdminOverview({
    capabilities: overview.capabilities.data,
    workflows: overview.workflows.data,
    nodeTypes: overview.nodeTypes.data,
    entityTypes: overview.entityTypes.data,
    auditRecords: overview.auditRecords.data,
  });

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title={t("admin.overviewTitle")}
        description={t("admin.overviewDescription")}
        icon="dashboard"
        actions={<AdminButton tone="secondary" compact icon="refresh" onClick={overview.refresh}>{t("admin.refresh")}</AdminButton>}
      />

      {overview.capabilities.state !== "hidden" && (
        <AdminOverviewAttentionSection capabilities={overview.capabilities} gaps={summary.requiredCapabilityGaps} />
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        {overview.nodeTypes.state !== "hidden" || overview.entityTypes.state !== "hidden" ? (
          <AdminDashboardMetricCard
            title={t("admin.overviewDataModel")}
            description={t("admin.overviewDataModelDescription")}
            icon="schema"
            href="/admin/model/types"
            state={overview.nodeTypes.state !== "hidden" ? overview.nodeTypes.state : overview.entityTypes.state}
            error={overview.nodeTypes.state !== "hidden" ? overview.nodeTypes.error : overview.entityTypes.error}
            unavailableLabel={t("admin.overviewUnavailable")}
          >
            <p className="text-2xl font-semibold tracking-tight text-slate-950"><span>{summary.activeNodeTypeCount}</span><span className="mx-2 text-sm font-normal text-slate-400">{t("admin.overviewNodeTypes")}</span><span>{summary.activeEntityTypeCount}</span><span className="ml-2 text-sm font-normal text-slate-400">{t("admin.overviewEntityTypes")}</span></p>
          </AdminDashboardMetricCard>
        ) : null}
        {overview.workflows.state !== "hidden" ? (
          <AdminDashboardMetricCard
            title={t("admin.workflows")}
            description={t("admin.overviewWorkflowsDescription")}
            icon="activity"
            href="/admin/automation/workflows"
            state={overview.workflows.state}
            error={overview.workflows.error}
            unavailableLabel={t("admin.overviewUnavailable")}
          >
            <p className="text-2xl font-semibold tracking-tight text-slate-950">{summary.activeWorkflowCount}<span className="ml-2 text-sm font-normal text-slate-500">{t("admin.overviewActiveWorkflows")}</span></p>
          </AdminDashboardMetricCard>
        ) : null}
        {overview.capabilities.state !== "hidden" ? (
          <AdminDashboardMetricCard
            title={t("admin.capabilities")}
            description={t("admin.overviewCapabilitiesDescription")}
            icon="settings"
            href="/admin/platform/runtime"
            state={overview.capabilities.state}
            error={overview.capabilities.error}
            unavailableLabel={t("admin.overviewUnavailable")}
          >
            <p className="text-2xl font-semibold tracking-tight text-slate-950">{summary.enabledCapabilityCount}<span className="ml-2 text-sm font-normal text-slate-500">{t("admin.overviewEnabledCapabilities")}</span></p>
          </AdminDashboardMetricCard>
        ) : null}
      </div>

      {overview.auditRecords.state !== "hidden" && <AdminOverviewRecentActivitySection auditRecords={overview.auditRecords} />}
    </section>
  );
}
