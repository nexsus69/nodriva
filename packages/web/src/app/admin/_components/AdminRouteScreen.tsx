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
import Link from "@/app/components/navigation/GuardedLink";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";

const MODULE_SCREENS: Record<string, () => React.ReactNode> = {
  overview: () => <AdminOverviewScreen />,
  "model.types": () => <AdminTypesPage />,
  "model.placement-policies": () => <PlacementPoliciesModuleScreen />,
  "model.field-protection": () => <SystemConfigModuleScreen kind="settings" section="field-protection" />,
  "content.nodes": () => <AdminContentModuleScreen kind="node" />,
  "content.entities": () => <AdminContentModuleScreen kind="entity" />,
  "access.users": () => <UsersModuleScreen />,
  "access.roles": () => <RolesModuleScreen />,
  "access.scopes": () => <ScopesModuleScreen />,
  "content.attachment-protection": () => <SystemConfigModuleScreen kind="settings" section="attachment-protection" />,
  "automation.workflows": () => <WorkflowModuleScreen />,
  "governance.audit": () => <AuditModuleScreen />,
  "governance.audit-recording": () => <SystemConfigModuleScreen kind="settings" section="audit-recording" />,
  "governance.recycle-bin": () => <RecycleBinModuleScreen />,
  "platform.runtime": () => <SystemConfigModuleScreen kind="capabilities" />,
  "platform.session-security": () => <SystemConfigModuleScreen kind="settings" section="session-security" />,
  "platform.other-settings": () => <SystemConfigModuleScreen kind="settings" section="other-settings" />,
};

function AdminUnknownModuleScreen() {
  const { t } = useAppLocale();
  return <section className="space-y-5 border border-slate-200 bg-white p-6"><h1 className="text-xl font-semibold text-slate-900">{t("admin.moduleNotFound")}</h1><p className="text-sm text-slate-600">{t("admin.moduleNotFoundDescription")}</p><Link href="/admin" className="inline-flex rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{t("admin.returnToOverview")}</Link></section>;
}

/** Renders a detail compatibility route or the screen registered for the path. */
export function AdminRouteScreen() {
  const pathname = usePathname();
  const rolePrefix = "/admin/access/roles/";
  const userPrefix = "/admin/access/users/";

  if (pathname.startsWith(rolePrefix)) {
    return <RoleDetailScreen roleKey={pathname.slice(rolePrefix.length)} />;
  }
  if (pathname.startsWith(userPrefix)) {
    return <UserDetailScreen userId={pathname.slice(userPrefix.length)} />;
  }

  const selectedModule = findAdminModuleByRoute(adminModuleRegistry.all(), pathname);
  const render = selectedModule ? MODULE_SCREENS[selectedModule.key] : undefined;
  return render ? render() : <AdminUnknownModuleScreen />;
}
