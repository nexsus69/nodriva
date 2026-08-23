"use client";

/** Keeps the catch-all route as a thin Admin Panel composition boundary. */
import { usePathname } from "next/navigation";
import { AdminOverviewScreen } from "../_components/AdminOverviewScreen";
import {
  AdminCollectionModuleScreen,
  keyFromPathname,
} from "../_components/AdminCollectionModuleScreen";
import { RolesModuleScreen } from "../security/roles/_components/RolesModuleScreen";
import { RoleDetailScreen } from "../security/roles/_components/RoleDetailScreen";

export default function AdminModulePage() {
  const pathname = usePathname();
  const roleDetailPrefix = "/admin/security/roles/";
  if (pathname.startsWith(roleDetailPrefix)) {
    return <RoleDetailScreen roleKey={pathname.slice(roleDetailPrefix.length)} />;
  }
  if (pathname === "/admin/security/roles") {
    return <RolesModuleScreen />;
  }
  return keyFromPathname(pathname) ? (
    <AdminCollectionModuleScreen pathname={pathname} />
  ) : (
    <AdminOverviewScreen pathname={pathname} />
  );
}
