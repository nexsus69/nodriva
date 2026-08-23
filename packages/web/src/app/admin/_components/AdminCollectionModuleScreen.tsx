"use client";

/** Composes all read-model administrative collections through one reusable screen. */
import { useMemo } from "react";
import type {
  AuditLogListItemDto,
  PlacementPolicyListItemDto,
  RoleListItemDto,
  RuntimeCapabilityDto,
  ScopeAssignmentDto,
  SystemSettingDto,
  UserListItemDto,
} from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { defineAdminResource, type AdminResourceDefinition } from "@/adminPanel/AdminResourceDefinition";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import type { AdminTableColumn } from "@/adminPanel/components/AdminTable";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";

type CollectionRow =
  | RoleListItemDto
  | ScopeAssignmentDto
  | AuditLogListItemDto
  | RuntimeCapabilityDto
  | SystemSettingDto
  | PlacementPolicyListItemDto
  | UserListItemDto
  | { id: string; kind: string; name: string; detail: string };

type CollectionKey =
  | "users"
  | "roles"
  | "scopes"
  | "audit"
  | "recycle"
  | "capabilities"
  | "settings"
  | "placement-policies";

const COLLECTIONS: Record<CollectionKey, { title: string; description: string }> = {
  users: { title: "Users", description: "Manage administrative accounts and access status." },
  roles: { title: "Roles", description: "Review the reusable permission roles." },
  scopes: { title: "Scopes", description: "Review user assignments and propagation scopes." },
  audit: { title: "Audit log", description: "Review administrative changes and their actors." },
  recycle: { title: "Recycle bin", description: "Review deleted nodes and entities before restore or purge actions are added." },
  capabilities: { title: "Capabilities", description: "Review runtime capabilities and their current status." },
  settings: { title: "System settings", description: "Review runtime-editable system settings." },
  "placement-policies": { title: "Placement policies", description: "Review policies used to control data placement." },
};

function keyFromPathname(pathname: string): CollectionKey | null {
  if (pathname === "/admin/users") return "users";
  if (pathname === "/admin/security/roles") return "roles";
  if (pathname === "/admin/security/scopes") return "scopes";
  if (pathname === "/admin/audit") return "audit";
  if (pathname === "/admin/recycle-bin") return "recycle";
  if (pathname === "/admin/system/config") return "capabilities";
  if (pathname === "/admin/system/placement-policies") return "placement-policies";
  return null;
}

async function unwrap<T>(
  result: Promise<{
    success: boolean;
    data?: T;
    error?: { message: string };
  }>,
) {
  const resolved = await result;
  if (!resolved.success || resolved.data === undefined) {
    throw new Error(resolved.error?.message ?? "Unable to load the administrative collection.");
  }
  return resolved.data;
}

async function loadRows(key: CollectionKey): Promise<CollectionRow[]> {
  switch (key) {
    case "users":
      return (await AppCache.users.listUsers()).map((user) => ({
        ...user,
        id: user.id,
      }));
    case "roles":
      return await unwrap(AppCache.admin.listRoles());
    case "scopes":
      return await unwrap(AppCache.admin.listScopeAssignments());
    case "audit":
      return (await unwrap(AppCache.admin.listAuditLogs({ page: 1, pageSize: 100 }))).items;
    case "capabilities":
      return await unwrap(AppCache.admin.listCapabilities());
    case "settings":
      return await unwrap(AppCache.admin.listSettings());
    case "placement-policies":
      return await unwrap(AppCache.admin.listPlacementPolicies());
    case "recycle": {
      const [nodes, entities] = await Promise.all([
        unwrap(AppCache.admin.listDeletedNodes()),
        unwrap(AppCache.admin.listDeletedEntities()),
      ]);
      return [
        ...nodes.map((row) => ({
          id: row.id,
          kind: "node",
          name: row.name,
          detail: row.path,
        })),
        ...entities.map((row) => ({
          id: row.id,
          kind: "entity",
          name: row.name,
          detail: row.entityTypeName,
        })),
      ];
    }
  }
}

function columnsFor(key: CollectionKey): readonly AdminTableColumn<CollectionRow>[] {
  switch (key) {
    case "users":
      return [
        { key: "email", label: "Email", render: (row: CollectionRow) => (row as UserListItemDto).email },
        { key: "status", label: "Status", render: (row: CollectionRow) => (row as UserListItemDto).isActive ? "Active" : "Disabled" },
        { key: "roles", label: "Roles", render: (row: CollectionRow) => (row as UserListItemDto).roles.map((role) => role.name).join(", ") || "—" },
      ];
    case "roles":
      return [
        { key: "name", label: "Name", render: (row: CollectionRow) => (row as RoleListItemDto).name },
        { key: "roleKey", label: "Key", render: (row: CollectionRow) => (row as RoleListItemDto).roleKey },
        { key: "permissions", label: "Permissions", render: (row: CollectionRow) => (row as RoleListItemDto).permissionCount },
      ];
    case "scopes":
      return [
        { key: "user", label: "User", render: (row: CollectionRow) => (row as ScopeAssignmentDto).userEmail },
        { key: "node", label: "Node", render: (row: CollectionRow) => (row as ScopeAssignmentDto).nodeName },
        { key: "role", label: "Role", render: (row: CollectionRow) => (row as ScopeAssignmentDto).roleName },
        { key: "propagation", label: "Propagation", render: (row: CollectionRow) => (row as ScopeAssignmentDto).propagation },
      ];
    case "audit":
      return [
        { key: "action", label: "Action", render: (row: CollectionRow) => (row as AuditLogListItemDto).actionKey },
        { key: "resource", label: "Resource", render: (row: CollectionRow) => `${(row as AuditLogListItemDto).resourceKind}:${(row as AuditLogListItemDto).resourceId}` },
        { key: "actor", label: "Actor", render: (row: CollectionRow) => (row as AuditLogListItemDto).actorEmail ?? "—" },
      ];
    case "capabilities":
      return [
        { key: "name", label: "Capability", render: (row: CollectionRow) => (row as RuntimeCapabilityDto).name },
        { key: "key", label: "Key", render: (row: CollectionRow) => (row as RuntimeCapabilityDto).capabilityKey },
        { key: "status", label: "Status", render: (row: CollectionRow) => (row as RuntimeCapabilityDto).currentStatus },
      ];
    case "settings":
      return [
        { key: "name", label: "Setting", render: (row: CollectionRow) => (row as SystemSettingDto).displayName },
        { key: "key", label: "Key", render: (row: CollectionRow) => (row as SystemSettingDto).settingKey },
        { key: "value", label: "Value", render: (row: CollectionRow) => (row as SystemSettingDto).isSecret ? "••••••" : (row as SystemSettingDto).valueText ?? "—" },
      ];
    case "placement-policies":
      return [
        { key: "name", label: "Policy", render: (row: CollectionRow) => (row as PlacementPolicyListItemDto).name },
        { key: "key", label: "Key", render: (row: CollectionRow) => (row as PlacementPolicyListItemDto).policyKey },
        { key: "mode", label: "Mode", render: (row: CollectionRow) => (row as PlacementPolicyListItemDto).policyMode },
      ];
    case "recycle":
      return [
        { key: "kind", label: "Kind", render: (row: CollectionRow) => (row as { kind: string }).kind },
        { key: "name", label: "Name", render: (row: CollectionRow) => (row as { name: string }).name },
        { key: "detail", label: "Detail", render: (row: CollectionRow) => (row as { detail: string }).detail },
      ];
  }
}

function resourceFor(key: CollectionKey): AdminResourceDefinition<CollectionRow> {
  const metadata = COLLECTIONS[key];
  return defineAdminResource<CollectionRow>({
    key,
    moduleKey: `admin.${key}`,
    label: metadata.title,
    description: metadata.description,
    list: {
      load: () => loadRows(key),
      columns: columnsFor(key),
      emptyLabel: "No records found",
      loadingLabel: "Loading administrative data",
    },
  });
}

export function AdminCollectionModuleScreen({ pathname }: { pathname: string }) {
  const key = keyFromPathname(pathname);
  const resource = useMemo(() => resourceFor(key ?? "users"), [key]);
  const collection = useAdminResourceController(resource, undefined);
  const definition = useMemo(() => {
    if (!key) return null;
    return {
      title: resource.label,
      description: resource.description,
      columns: resource.list.columns,
      loadingLabel: resource.list.loadingLabel,
      emptyLabel: resource.list.emptyLabel,
      loading: collection.loading,
      error: collection.error,
      rows: collection.rows,
    } as AdminCollectionDefinition<CollectionRow>;
  }, [collection, key, resource]);
  if (!definition) return null;
  return <AdminCollectionScreen definition={definition} />;
}

export { keyFromPathname };
