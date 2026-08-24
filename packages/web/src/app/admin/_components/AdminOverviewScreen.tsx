"use client";

/** Renders the Admin Panel overview from the shared module registry. */
import Link from "@/app/components/navigation/GuardedLink";
import {
  findAdminModuleByRoute,
} from "@/adminPanel/AdminModule";
import { adminModuleRegistry } from "@/adminPanel/AdminModuleRegistry";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminIcon } from "@/adminPanel/components/AdminIcon";
import { AdminPageHeader } from "@/adminPanel/components/AdminPageHeader";

/** Presents the overview cards and the contextual module heading. */
export function AdminOverviewScreen({ pathname }: { pathname: string }) {
  const { t } = useAppLocale();
  const authorization = useAdminAuthorization();
  const visibleModules = adminModuleRegistry.visible(authorization);
  const selectedModule = findAdminModuleByRoute(
    visibleModules,
    pathname,
  );
  const isOverview = pathname === "/admin";
  const groups = visibleModules.filter((module) => module.key !== "overview");

  return (
    <div className="space-y-7">
      <AdminPageHeader
        title={isOverview
          ? t("admin.overviewTitle")
          : t(selectedModule?.labelKey ?? selectedModule?.label ?? "admin.module")}
        description={isOverview
          ? t("admin.overviewDescription")
          : t(selectedModule?.descriptionKey ?? selectedModule?.description ?? "admin.selectModule")}
        icon={selectedModule?.icon ?? "dashboard"}
      />
      {isOverview && (
        <div className="grid gap-5 xl:grid-cols-2">
          {groups.map((group) => (
            <section key={group.key} className="border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center bg-violet-50 text-violet-700">
                  <AdminIcon name={group.icon ?? "dashboard"} className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-950">
                    {t(group.labelKey ?? group.label)}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {t(group.descriptionKey ?? group.description ?? "")}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {(group.children ?? []).map((module) => (
                  <Link
                    key={module.key}
                    href={module.route ?? "/admin"}
                    className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
                  >
                    <AdminIcon name={module.icon ?? group.icon ?? "dashboard"} className="size-4 shrink-0 text-slate-400 group-hover:text-violet-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800">
                        {t(module.labelKey ?? module.label)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {t(module.descriptionKey ?? module.description ?? "")}
                      </span>
                    </span>
                    <AdminIcon name="chevron-right" className="size-4 text-slate-300 group-hover:text-violet-600" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
