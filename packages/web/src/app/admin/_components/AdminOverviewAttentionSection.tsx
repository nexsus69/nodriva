"use client";

/** Presents only configuration gaps that require an administrator's decision. */
import Link from "@/app/components/navigation/GuardedLink";
import type { RuntimeCapabilityDto } from "@dashboard/core";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminDashboardReadState } from "@/adminPanel/components/AdminDashboardReadState";
import { AdminIcon } from "@/adminPanel/components/AdminIcon";
import type { AdminOverviewRead } from "./useAdminOverview";

export function AdminOverviewAttentionSection({
  capabilities,
  gaps,
}: {
  capabilities: AdminOverviewRead<RuntimeCapabilityDto>;
  gaps: readonly RuntimeCapabilityDto[];
}) {
  const { t } = useAppLocale();
  return (
    <section data-testid="admin-overview-attention" className="border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <span className={`flex size-9 shrink-0 items-center justify-center ${gaps.length > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
          <AdminIcon name={gaps.length > 0 ? "settings" : "shield"} className="size-4.5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{t("admin.overviewAttention")}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{t("admin.overviewAttentionDescription")}</p>
        </div>
      </div>
      <div className="p-5">
        <AdminDashboardReadState state={capabilities.state} error={capabilities.error} unavailableLabel={t("admin.overviewUnavailable")}>
          {gaps.length === 0 ? (
            <p className="text-sm font-medium text-emerald-700">{t("admin.overviewAllClear")}</p>
          ) : (
            <ul className="space-y-3">
              {gaps.map((capability) => (
                <li key={capability.id} className="flex items-center justify-between gap-4 text-sm">
                  <span><strong className="font-medium text-slate-900">{capability.name}</strong><span className="ml-2 text-slate-500">{capability.description}</span></span>
                  <Link href="/admin/system/config" className="shrink-0 font-semibold text-violet-700 hover:text-violet-900">{t("admin.overviewReview")}</Link>
                </li>
              ))}
            </ul>
          )}
        </AdminDashboardReadState>
      </div>
    </section>
  );
}
