"use client";

/** Shares the verified administrative permission projection with UI composition. */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AdminModuleContext } from "./AdminModule";

const EMPTY_CONTEXT: AdminModuleContext = {
  permissions: new Set<string>(),
};

const AdminAuthorizationContext = createContext<AdminModuleContext>(EMPTY_CONTEXT);

/** Provides a stable permission set to navigation and resource hosts. */
export function AdminAuthorizationProvider({
  permissions,
  children,
}: {
  permissions: readonly string[];
  children: ReactNode;
}) {
  const context = useMemo<AdminModuleContext>(
    () => ({ permissions: new Set(permissions) }),
    [permissions],
  );

  return (
    <AdminAuthorizationContext.Provider value={context}>
      {children}
    </AdminAuthorizationContext.Provider>
  );
}

/** Returns the authorization projection verified by the backend. */
export function useAdminAuthorization(): AdminModuleContext {
  return useContext(AdminAuthorizationContext);
}
