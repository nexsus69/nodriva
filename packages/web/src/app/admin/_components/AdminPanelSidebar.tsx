"use client";

/** Renders the new recursive module navigation without page-specific groups. */
import { useEffect, useMemo } from "react";
import Link from "@/app/components/navigation/GuardedLink";
import { adminModuleRegistry } from "@/adminPanel/AdminModuleRegistry";
import {
  findAdminModuleByRoute,
  type AdminModule,
} from "@/adminPanel/AdminModule";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";

function ModuleTree({
  modules,
  pathname,
  onClose,
}: {
  modules: readonly AdminModule[];
  pathname: string;
  onClose: () => void;
}) {
  const { t } = useAppLocale();
  const activeModuleKey = useAdminWorkspaceStore(
    (state) => state.activeModuleKey,
  );
  const expandedModuleKeys = useAdminWorkspaceStore(
    (state) => state.expandedModuleKeys,
  );
  const setActiveModule = useAdminWorkspaceStore(
    (state) => state.setActiveModule,
  );
  const toggleModule = useAdminWorkspaceStore((state) => state.toggleModule);
  return (
    <div className="space-y-1">
      {modules.map((module) => {
        const hasChildren = Boolean(module.children?.length);
        const expanded = expandedModuleKeys.includes(module.key);
        const active =
          activeModuleKey === module.key ||
          (module.route === "/admin"
            ? pathname === module.route
            : Boolean(module.route && pathname.startsWith(module.route)));
        const className = `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${active ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`;
        return (
          <div key={module.key}>
            {module.route ? (
              <Link
                href={module.route}
                onClick={() => {
                  setActiveModule(module.key);
                  onClose();
                }}
                className={className}
              >
                <span className="w-5 text-center">{module.icon ?? "•"}</span>
                <span className="min-w-0 flex-1 truncate">
                  {t(module.labelKey ?? module.label)}
                </span>
                {hasChildren && <span>{expanded ? "▾" : "▸"}</span>}
              </Link>
            ) : (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleModule(module.key)}
                className={className}
              >
                <span className="w-5 text-center">{module.icon ?? "•"}</span>
                <span className="min-w-0 flex-1 truncate">
                  {t(module.labelKey ?? module.label)}
                </span>
                {hasChildren && <span>{expanded ? "▾" : "▸"}</span>}
              </button>
            )}
            {hasChildren && expanded && (
              <div className="ml-4 mt-1 border-l border-slate-200 pl-2">
                <ModuleTree
                  modules={module.children!}
                  pathname={pathname}
                  onClose={onClose}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Provides the responsive navigation rail for the rebuilt Admin Panel. */
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
  const modules = adminModuleRegistry.all();
  const setActiveModule = useAdminWorkspaceStore(
    (state) => state.setActiveModule,
  );
  const expandModule = useAdminWorkspaceStore((state) => state.expandModule);
  const activeRoot = useMemo(() => {
    const active = findAdminModuleByRoute(modules, pathname);
    return (
      modules.find(
        (module) =>
          active?.key === module.key ||
          active?.key.startsWith(`${module.key}.`),
      ) ?? modules[0]
    );
  }, [modules, pathname]);
  useEffect(() => {
    const active = findAdminModuleByRoute(modules, pathname);
    if (!active) return;
    setActiveModule(active.key);
    active.key
      .split(".")
      .slice(0, -1)
      .forEach((_, index, ancestors) =>
        expandModule(ancestors.slice(0, index + 1).join(".")),
      );
  }, [expandModule, modules, pathname, setActiveModule]);
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close administration menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/25 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[21rem] -translate-x-full border-r border-slate-200 bg-white shadow-xl transition-transform lg:static lg:translate-x-0 lg:shadow-none ${open ? "translate-x-0" : ""}`}
      >
        <nav
          aria-label="Administration modules"
          className="flex w-16 shrink-0 flex-col items-center bg-slate-950 py-4 text-slate-400"
        >
          <Link
            href="/admin"
            onClick={onClose}
            aria-label={t("admin.panel")}
            className="mb-6 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white"
          >
            N
          </Link>
          <div className="flex flex-1 flex-col items-center gap-2">
            {modules.map((module) => {
              const selected = activeRoot?.key === module.key;
              const content = (
                <span
                  className={`flex h-10 w-10 items-center justify-center text-lg transition ${selected ? "bg-indigo-500 text-white" : "hover:bg-white/10 hover:text-white"}`}
                  title={module.label}
                >
                  {module.icon === "dashboard"
                    ? "⌂"
                    : module.icon === "schema"
                      ? "◇"
                      : module.icon === "shield"
                        ? "◈"
                        : module.icon === "activity"
                          ? "◌"
                          : "⚙"}
                </span>
              );
              return module.route ? (
                <Link
                  key={module.key}
                  href={module.route}
                  onClick={() => {
                    setActiveModule(module.key);
                    onClose();
                  }}
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={module.key}
                  type="button"
                  onClick={() => {
                    setActiveModule(module.key);
                    expandModule(module.key);
                  }}
                >
                  {content}
                </button>
              );
            })}
          </div>
          <Link
            href="/"
            onClick={onClose}
            aria-label={t("admin.operationalArea")}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg hover:bg-white/10 hover:text-white"
          >
            ↗
          </Link>
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
            <div>
              <p className="text-sm font-bold text-slate-900">Nodriva</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                {t("admin.panel")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("admin.openMenu")}
              className="text-lg text-slate-400 lg:hidden"
            >
              ×
            </button>
          </div>
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {activeRoot
                ? t(activeRoot.labelKey ?? activeRoot.label)
                : t("admin.panel")}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {activeRoot
                ? t(activeRoot.descriptionKey ?? activeRoot.description ?? "")
                : ""}
            </p>
          </div>
          <nav
            aria-label={`${activeRoot ? t(activeRoot.labelKey ?? activeRoot.label) : t("admin.panel")} sections`}
            className="flex-1 overflow-y-auto p-4"
          >
            <ModuleTree
              modules={
                activeRoot?.children ??
                ([activeRoot].filter(Boolean) as AdminModule[])
              }
              pathname={pathname}
              onClose={onClose}
            />
          </nav>
        </div>
      </aside>
    </>
  );
}
