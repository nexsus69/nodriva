"use client";

/** Resolves Admin Panel screens from the canonical module registry. */
import { usePathname } from "next/navigation";
import { findAdminModuleByRoute } from "@/adminPanel/AdminModule";
import { adminModuleRegistry } from "@/adminPanel/AdminModuleRegistry";
import { AuditModuleScreen } from "../activity/_components/AuditModuleScreen";
import { RecycleBinModuleScreen } from "../activity/_components/RecycleBinModuleScreen";
import { RoleDetailScreen } from "../security/roles/_components/RoleDetailScreen";
import { RolesModuleScreen } from "../security/roles/_components/RolesModuleScreen";
import { ScopesModuleScreen } from "../security/scopes/_components/ScopesModuleScreen";
import { UserDetailScreen } from "../security/users/_components/UserDetailScreen";
import { UsersModuleScreen } from "../security/users/_components/UsersModuleScreen";
import { PlacementPoliciesModuleScreen } from "../system/_components/PlacementPoliciesModuleScreen";
import { SystemConfigModuleScreen } from "../system/_components/SystemConfigModuleScreen";
import { WorkflowModuleScreen } from "../system/_components/WorkflowModuleScreen";
import AdminTypesPage from "../types/_components/TypesModuleScreen";
import { AdminOverviewScreen } from "./AdminOverviewScreen";
import { AdminContentModuleScreen } from "../content/_components/AdminContentModuleScreen";

const MODULE_SCREENS: Record<string, () => React.ReactNode> = {
  overview: () => <AdminOverviewScreen />,
  "model.types": () => <AdminTypesPage />,
  "content.nodes": () => <AdminContentModuleScreen kind="node" />,
  "content.entities": () => <AdminContentModuleScreen kind="entity" />,
  "access.users": () => <UsersModuleScreen />,
  "access.roles": () => <RolesModuleScreen />,
  "access.scopes": () => <ScopesModuleScreen />,
  "activity.audit": () => <AuditModuleScreen />,
  "activity.recycle-bin": () => <RecycleBinModuleScreen />,
  "system.capabilities": () => <SystemConfigModuleScreen kind="capabilities" />,
  "system.settings": () => <SystemConfigModuleScreen kind="settings" />,
  "system.placement-policies": () => <PlacementPoliciesModuleScreen />,
  "system.workflows": () => <WorkflowModuleScreen />,
};

/** Renders a detail compatibility route or the screen registered for the path. */
export function AdminRouteScreen() {
  const pathname = usePathname();
  const rolePrefix = "/admin/security/roles/";
  const userPrefix = "/admin/users/";

  if (pathname.startsWith(rolePrefix)) {
    return <RoleDetailScreen roleKey={pathname.slice(rolePrefix.length)} />;
  }
  if (pathname.startsWith(userPrefix)) {
    return <UserDetailScreen userId={pathname.slice(userPrefix.length)} />;
  }

  const selectedModule = findAdminModuleByRoute(adminModuleRegistry.all(), pathname);
  const render = selectedModule ? MODULE_SCREENS[selectedModule.key] : undefined;
  return render ? render() : <AdminOverviewScreen />;
}
