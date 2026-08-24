"use client";

/** Composes access checks, persistent workspace state, navigation, and content. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "@/app/components/navigation/GuardedLink";
import { adminModuleRegistry } from "@/adminPanel/AdminModuleRegistry";
import { findAdminModuleByRoute } from "@/adminPanel/AdminModule";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { checkAdminAccessAction } from "../../actions/adminAccessActions";
import { AdminPanelHeader } from "./AdminPanelHeader";
import { AdminPanelSidebar } from "./AdminPanelSidebar";
import { ConfirmDialogHost } from "@/app/components/ui/feedback/ConfirmDialog";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminAuthorizationProvider } from "@/adminPanel/AdminAuthorizationContext";

/** Hosts the rebuilt Admin Panel while preserving the existing backend access contract. */
export function AdminPanelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const setUserContext = useAdminWorkspaceStore(
    (state) => state.setUserContext,
  );
  const activeModuleKey = useAdminWorkspaceStore(
    (state) => state.activeModuleKey,
  );
  const { t } = useAppLocale();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [access, setAccess] = useState<
    "checking" | "allowed" | "denied" | "unavailable"
  >("checking");
  const [permissions, setPermissions] = useState<readonly string[]>([]);
  const activeModule = useMemo(
    () => findAdminModuleByRoute(
      adminModuleRegistry.visible({ permissions: new Set(permissions) }),
      pathname,
    ),
    [pathname, permissions],
  );
  useEffect(() => {
    if (sessionStatus === "loading") return;
    const userId =
      session?.user &&
      "id" in session.user &&
      typeof session.user.id === "string"
        ? session.user.id
        : (session?.user?.email ?? null);
    setUserContext(userId);
  }, [session?.user, sessionStatus, setUserContext]);
  const loadAccess = useCallback(() => {
    let cancelled = false;
    void checkAdminAccessAction()
      .then((result) => {
        if (cancelled) return;
        setPermissions(result.permissions);
        setAccess(result.allowed ? "allowed" : "denied");
      })
      .catch(() => {
        if (!cancelled) setAccess("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    return loadAccess();
  }, [loadAccess]);
  const retryAccess = () => {
    setAccess("checking");
    loadAccess();
  };
  if (access === "checking")
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-300">
        {t("admin.checkingAccess")}
      </div>
    );
  if (access === "denied")
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h1 className="text-xl font-semibold">
            {t("admin.accessDenied")}
          </h1>
          <p className="text-sm text-slate-400">
            {t("admin.accessDeniedDescription")}
          </p>
          <Link
            href="/"
            className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {t("admin.returnToWorkspace")}
          </Link>
        </div>
      </div>
    );
  if (access === "unavailable")
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md space-y-4 rounded-2xl border border-amber-500/30 bg-slate-900 p-8 text-center">
          <h1 className="text-xl font-semibold">
            {t("admin.accessUnavailable")}
          </h1>
          <p className="text-sm text-slate-400">
            {t("admin.accessUnavailableDescription")}
          </p>
          <button
            type="button"
            onClick={retryAccess}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {t("admin.retry")}
          </button>
        </div>
      </div>
    );
  return (
    <AdminAuthorizationProvider permissions={permissions}>
      <div className="admin-page flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900">
      <AdminPanelSidebar
        pathname={pathname}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminPanelHeader
          email={session?.user?.email ?? "unknown user"}
          activeModuleLabel={
            activeModule?.labelKey
              ? t(activeModule.labelKey)
              : (activeModule?.label ?? activeModuleKey)
          }
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <ConfirmDialogHost />
      </div>
    </AdminAuthorizationProvider>
  );
}
