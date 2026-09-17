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
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminAuthorizationProvider } from "@/adminPanel/AdminAuthorizationContext";
import { AdminButton } from "@/adminPanel/components/AdminButton";
import { AdminIcon } from "@/adminPanel/components/AdminIcon";
import { Skeleton } from "@/app/components/ui/feedback";

/** Renders a stable Admin shell while access is resolved without flashing content. */
function AdminShellSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" aria-busy="true">
      <div className="hidden w-[19.5rem] shrink-0 border-r border-slate-200 bg-white lg:flex">
        <div className="w-14 bg-slate-950" />
        <div className="flex-1 space-y-3 p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-4/5" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-14 border-b border-slate-200 bg-white" />
        <div className="space-y-6 p-6 lg:p-8">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

/** Renders one consistent full-page status for denied or unavailable access. */
function AdminAccessState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <div className="w-full max-w-md border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex size-11 items-center justify-center bg-amber-50 text-amber-700">
          <AdminIcon name="shield" className="size-5" />
        </span>
        <h1 className="mt-5 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-6 flex justify-center">{action}</div>
      </div>
    </div>
  );
}

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
  const workspaceUserId =
    session?.user &&
    "id" in session.user &&
    typeof session.user.id === "string"
      ? session.user.id
      : (session?.user?.email ?? null);
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (sessionStatus === "unauthenticated") {
      setUserContext(null);
      return;
    }
    // A transient incomplete session payload must not impersonate a logout and
    // discard a draft. The store is reset only for a confirmed user boundary.
    if (workspaceUserId) setUserContext(workspaceUserId);
  }, [sessionStatus, setUserContext, workspaceUserId]);
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
    return <AdminShellSkeleton />;
  if (access === "denied")
    return (
      <AdminAccessState
        title={t("admin.accessDenied")}
        description={t("admin.accessDeniedDescription")}
        action={
          <Link
            href="/"
            className="inline-flex min-h-10 items-center bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            {t("admin.returnToWorkspace")}
          </Link>
        }
      />
    );
  if (access === "unavailable")
    return (
      <AdminAccessState
        title={t("admin.accessUnavailable")}
        description={t("admin.accessUnavailableDescription")}
        action={
          <AdminButton tone="secondary" icon="refresh" onClick={retryAccess}>
            {t("admin.retry")}
          </AdminButton>
        }
      />
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
          <div className="mx-auto max-w-[90rem]">{children}</div>
        </main>
      </div>
      </div>
    </AdminAuthorizationProvider>
  );
}
