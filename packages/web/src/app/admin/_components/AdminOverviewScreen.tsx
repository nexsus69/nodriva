"use client";

/** Renders the Admin Panel overview from the shared module registry. */
import Link from "@/app/components/navigation/GuardedLink";
import {
  findAdminModuleByRoute,
  type AdminModule,
} from "@/adminPanel/AdminModule";
import { adminModuleRegistry } from "@/adminPanel/AdminModuleRegistry";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";

function navigableModules(modules: readonly AdminModule[]): AdminModule[] {
  return modules.flatMap((module) =>
    module.children?.length
      ? navigableModules(module.children)
      : module.route
        ? [module]
        : [],
  );
}

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
  const modules = navigableModules(visibleModules);

  return (
    <div className="space-y-8">
      <section className="border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
          {t("admin.panel")}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {isOverview
            ? t("admin.overviewTitle")
            : t(selectedModule?.labelKey ?? selectedModule?.label ?? "admin.module")}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          {isOverview
            ? t("admin.overviewDescription")
            : t(selectedModule?.descriptionKey ?? selectedModule?.description ?? "admin.selectModule")}
        </p>
      </section>
      {isOverview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Link
              key={module.key}
              href={module.route ?? "/admin"}
              className="border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-sm"
            >
              <span className="text-2xl">{module.icon ?? "•"}</span>
              <h3 className="mt-4 font-semibold text-slate-900">
                {t(module.labelKey ?? module.label)}
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {t(module.descriptionKey ?? module.description ?? "")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
