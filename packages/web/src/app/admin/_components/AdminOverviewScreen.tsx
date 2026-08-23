"use client";

/** Renders the Admin Panel overview from the shared module registry. */
import Link from "@/app/components/navigation/GuardedLink";
import {
  findAdminModuleByRoute,
  type AdminModule,
} from "@/adminPanel/AdminModule";
import { adminModuleRegistry } from "@/adminPanel/AdminModuleRegistry";

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
  const selectedModule = findAdminModuleByRoute(
    adminModuleRegistry.all(),
    pathname,
  );
  const isOverview = pathname === "/admin";
  const modules = navigableModules(adminModuleRegistry.all());

  return (
    <div className="space-y-8">
      <section className="border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Nodriva Admin Panel
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {isOverview
            ? "Administration at a glance"
            : selectedModule?.label ?? "Module"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          {isOverview
            ? "Manage the model, access, activity, and system configuration from one workspace."
            : selectedModule?.description ?? "Select an administrative module."}
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
                {module.label}
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {module.description}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
