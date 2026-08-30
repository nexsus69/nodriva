"use client";

/** Renders registry-driven primary and contextual Admin navigation. */
import { useEffect, useMemo } from "react";
import Link from "@/app/components/navigation/GuardedLink";
import { AdminIcon } from "@/adminPanel/components/AdminIcon";
import { adminModuleRegistry } from "@/adminPanel/AdminModuleRegistry";
import {
  findAdminModuleByRoute,
  isAdminModuleRouteMatch,
  type AdminModule,
} from "@/adminPanel/AdminModule";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";

/** Renders one contextual navigation branch at any registry depth. */
function ModuleTree({
  modules,
  pathname,
  onNavigate,
}: {
  modules: readonly AdminModule[];
  pathname: string;
  onNavigate: () => void;
}) {
  const { t } = useAppLocale();
  const activeModuleKey = useAdminWorkspaceStore((state) => state.activeModuleKey);
  const expandedModuleKeys = useAdminWorkspaceStore((state) => state.expandedModuleKeys);
  const setActiveModule = useAdminWorkspaceStore((state) => state.setActiveModule);
  const toggleModule = useAdminWorkspaceStore((state) => state.toggleModule);

  return (
    <div className="space-y-1">
      {modules.map((module) => {
        const hasChildren = Boolean(module.children?.length);
        const expanded = expandedModuleKeys.includes(module.key);
        const active = activeModuleKey === module.key || Boolean(
          module.route && isAdminModuleRouteMatch(module.route, pathname),
        );
        const content = (
          <>
            <AdminIcon name={module.icon ?? "dashboard"} className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {t(module.labelKey ?? module.label)}
            </span>
            {hasChildren && (
              <AdminIcon
                name="chevron-down"
                className={`size-3.5 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`}
              />
            )}
          </>
        );
        const className = `flex min-h-9 w-full items-center gap-2.5 px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`;

        return (
          <div key={module.key}>
            {module.route ? (
              <Link
                href={module.route}
                onClick={() => {
                  setActiveModule(module.key);
                  onNavigate();
                }}
                className={className}
              >
                {content}
              </Link>
            ) : (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleModule(module.key)}
                className={className}
              >
                {content}
              </button>
            )}
            {hasChildren && expanded && (
              <div className="ml-4 mt-1 border-l border-slate-200 pl-2">
                <ModuleTree
                  modules={module.children!}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Renders one primary rail target with a visible hover/focus tooltip. */
function RailTarget({
  label,
  icon,
  selected,
  onClick,
  href,
}: {
  label: string;
  icon: string;
  selected?: boolean;
  onClick: () => void;
  href?: string;
}) {
  const className = `group relative flex size-11 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${selected ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"}`;
  const content = (
    <>
      <AdminIcon name={icon} className="size-5" />
      <span className="pointer-events-none absolute left-[3.25rem] z-50 hidden whitespace-nowrap border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block">
        {label}
      </span>
    </>
  );

  return href ? (
    <Link href={href} aria-label={label} onClick={onClick} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={className}>
      {content}
    </button>
  );
}

/** Provides the responsive two-level navigation used by the Admin Panel. */
export function AdminPanelSidebar({
  pathname,
  open,
  onClose,
}: {
  pathname: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useAppLocale();
  const authorization = useAdminAuthorization();
  const modules = useMemo(
    () => adminModuleRegistry.visible(authorization),
    [authorization],
  );
  const activeModuleKey = useAdminWorkspaceStore((state) => state.activeModuleKey);
  const setActiveModule = useAdminWorkspaceStore((state) => state.setActiveModule);
  const expandModule = useAdminWorkspaceStore((state) => state.expandModule);
  const activeRoot = useMemo(() => {
    const active = adminModuleRegistry.find(activeModuleKey) ??
      findAdminModuleByRoute(modules, pathname);
    return modules.find((module) =>
      active?.key === module.key || active?.key.startsWith(`${module.key}.`),
    ) ?? modules[0];
  }, [activeModuleKey, modules, pathname]);

  useEffect(() => {
    const active = findAdminModuleByRoute(modules, pathname);
    if (!active) return;
    setActiveModule(active.key);
    const segments = active.key.split(".").slice(0, -1);
    segments.forEach((_, index) => {
      expandModule(segments.slice(0, index + 1).join("."));
    });
  }, [expandModule, modules, pathname, setActiveModule]);

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label={t("admin.closeMenu")}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[19.5rem] -translate-x-full border-r border-slate-200 bg-white shadow-xl transition-transform lg:static lg:translate-x-0 lg:shadow-none ${open ? "translate-x-0" : ""}`}
      >
        <nav
          aria-label={t("admin.navigation")}
          className="flex w-14 shrink-0 flex-col items-center bg-slate-950"
        >
          <Link
            href="/admin"
            onClick={onClose}
            aria-label={t("admin.panel")}
            className="flex size-14 items-center justify-center bg-blue-600 text-2xl font-black leading-none text-white"
          >
            N
          </Link>
          <div className="flex flex-1 flex-col items-center gap-1 py-3">
            {modules.map((module) => (
              <RailTarget
                key={module.key}
                label={t(module.labelKey ?? module.label)}
                icon={module.icon ?? "dashboard"}
                selected={activeRoot?.key === module.key}
                href={module.route}
                onClick={() => {
                  setActiveModule(module.key);
                  expandModule(module.key);
                  if (module.route) onClose();
                }}
              />
            ))}
          </div>
          <div className="border-t border-white/10 py-2">
            <RailTarget
              label={t("admin.operationalArea")}
              icon="external"
              href="/"
              onClick={onClose}
            />
          </div>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <AdminIcon name={activeRoot?.icon ?? "dashboard"} className="size-4 shrink-0 text-blue-600" />
              <p className="truncate text-sm font-semibold text-slate-950">
                {activeRoot ? t(activeRoot.labelKey ?? activeRoot.label) : t("admin.panel")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("admin.closeMenu")}
              className="flex size-8 items-center justify-center text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <AdminIcon name="close" className="size-4" />
            </button>
          </div>
          <nav
            aria-label={`${activeRoot ? t(activeRoot.labelKey ?? activeRoot.label) : t("admin.panel")} · ${t("admin.sections")}`}
            className="flex-1 overflow-y-auto p-3"
          >
            <ModuleTree
              modules={activeRoot?.children ?? ([activeRoot].filter(Boolean) as AdminModule[])}
              pathname={pathname}
              onNavigate={onClose}
            />
          </nav>
          {activeRoot?.descriptionKey && (
            <p className="border-t border-slate-200 px-4 py-3 text-[11px] leading-5 text-slate-500">
              {t(activeRoot.descriptionKey)}
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
