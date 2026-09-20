"use client";

/** Composes the role collection from the reusable resource definition and controller. */
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoleListItemDto } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { AdminFormDialog } from "@/adminPanel/components/AdminFormDialog";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import {
  createRoleForm,
  createRoleResource,
  ROLE_CREATE_SURFACE,
  type RoleForm,
} from "./roleResource";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { RoleDetailScreen } from "./RoleDetailScreen";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { canUseAdminResourceOperation } from "@/adminPanel/AdminResourceDefinition";
import { useAdminRemotePagination } from "@/adminPanel/useAdminRemotePagination";
import { useAdminRealtimeCollectionRefresh } from "@/adminPanel/useAdminRealtimeCollectionRefresh";
import type { AdminTableSortState } from "@/adminPanel/components/AdminTable";

const EMPTY_ROLE: RoleForm = {
  roleKey: "",
  name: "",
  description: "",
  permissionIds: [],
  customKey: false,
};

function useRolesRemoteCoordinator() {
  const moduleKey = "access.roles";
  const moduleState = useAdminWorkspaceStore((state) => state.moduleState[moduleKey]);
  const setModuleState = useAdminWorkspaceStore((state) => state.setModuleState);
  const [rows, setRows] = useState<readonly RoleListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [sort, setSortState] = useState<AdminTableSortState | null>(null);
  const version = useRef(0);
  const search = typeof moduleState?.search === "string" ? moduleState.search : "";
  const pagination = useAdminRemotePagination({ total, stateKey: moduleKey });
  const { page: currentPage, pageSize, setPage, reset } = pagination;
  const load = useCallback(async (requestedPage = currentPage) => {
    const request = ++version.current;
    setLoading(true); setError(null);
    const acceptedSort = sort && ["name", "roleKey", "permissions"].includes(sort.columnKey)
      ? { key: sort.columnKey as "name" | "roleKey" | "permissions", direction: sort.direction } : undefined;
    try {
      const response = await AppCache.adminRoles.read({ page: requestedPage, pageSize, search: search.trim() || undefined, sort: acceptedSort });
      if (request !== version.current) return;
      setRows(response.items); setTotal(response.total); setPage(response.page);
    } catch (reason) { if (request === version.current) setError(reason instanceof Error ? reason : new Error(String(reason))); }
    finally { if (request === version.current) setLoading(false); }
  }, [currentPage, pageSize, search, setPage, sort]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useAdminRealtimeCollectionRefresh(["roles", "role"], () => load(currentPage));
  const setSearch = useCallback((next: string) => { reset(); setModuleState(moduleKey, { search: next }); }, [reset, setModuleState]);
  const setSort = useCallback((next: AdminTableSortState) => { reset(); setSortState(next); }, [reset]);
  const execute = useCallback(async (work: () => Promise<void>) => { setPending(true); setError(null); try { await work(); await load(); return true; } catch (reason) { setError(reason instanceof Error ? reason : new Error(String(reason))); return false; } finally { setPending(false); } }, [load]);
  return { rows, loading, pending, error, search, setSearch, sort, setSort, pagination, load, execute };
}

/** Proposes the same stable key grammar used by backend role validation. */
function roleKeyFromName(value: unknown): string {
  const normalized = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!normalized) return "role";
  return normalized.match(/^[a-z]/) ? normalized : `role_${normalized}`;
}

/** Renders the complete role list and create flow without owning resource lifecycle state. */
export function RolesModuleScreen() {
  const { t } = useAppLocale();
  const selectedResource = useAdminWorkspaceStore((state) => state.selectedResource);
  const selectResource = useAdminWorkspaceStore((state) => state.selectResource);
  const authorization = useAdminAuthorization();
  const resource = useMemo(() => createRoleResource(t), [t]);
  const controller = useRolesRemoteCoordinator();
  const canCreate = canUseAdminResourceOperation(resource, "create", authorization.permissions);
  const formSurface = useAdminFormSurface<RoleForm>({
    moduleKey: resource.moduleKey,
    surfaceKey: ROLE_CREATE_SURFACE.key,
    surfaceKind: ROLE_CREATE_SURFACE.presentation,
    draftKey: "admin.roles.create",
    formVersion: "2",
    initialValues: EMPTY_ROLE,
    closePolicy: "discard",
    confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"),
    confirmDescription: t("admin.discardDescription"),
    confirmConfirmLabel: t("admin.discardChanges"),
    confirmCancelLabel: t("admin.keepEditing"),
  });
  const formDefinition = useMemo(() => createRoleForm(t, Boolean(formSurface.values.customKey)), [formSurface.values.customKey, t]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await controller.execute(async () => {
      const result = await AppCache.admin.createRole({ roleKey: formSurface.values.roleKey.trim(), name: formSurface.values.name.trim(), description: formSurface.values.description.trim() || undefined, permissionIds: formSurface.values.permissionIds });
      if (!result.success) throw new Error(result.error?.message ?? t("admin.loadingRoles"));
    });
    if (created) formSurface.complete();
  };

  const definition: AdminCollectionDefinition<(typeof controller.rows)[number]> = {
    title: resource.label,
    description: resource.description,
    icon: "roles",
    columns: resource.list.columns,
    loadingLabel: resource.list.loadingLabel,
    emptyLabel: resource.list.emptyLabel,
    rows: controller.rows,
    loading: controller.loading,
    error: controller.error,
    createLabel: canCreate ? t("admin.createRole") : undefined,
    onCreate: canCreate ? () => formSurface.open({ mode: "create" }) : undefined,
    onOpen: (row) => selectResource({ moduleKey: resource.moduleKey, resourceId: row.roleKey }),
    rowLabel: (row) => row.name,
    actionMenuLabel: t("admin.actions"),
    refreshLabel: t("admin.refresh"),
    onRefresh: () => void controller.load(controller.pagination.page),
    search: { value: controller.search, label: "Cerca ruoli", placeholder: "Cerca ruoli", onChange: controller.setSearch },
    pagination: { mode: "remote", page: controller.pagination.page, pageCount: controller.pagination.pageCount, onPageChange: (page) => void controller.load(page), sort: controller.sort, onSortChange: controller.setSort },
  };

  if (selectedResource?.moduleKey === resource.moduleKey && selectedResource.resourceId) {
    return <RoleDetailScreen roleKey={selectedResource.resourceId} onClose={() => selectResource(null)} />;
  }

  return (
    <>
      <AdminCollectionScreen definition={definition} />
      {formSurface.isOpen && (
        <AdminFormDialog
          title={t("admin.createRole")}
          definition={formDefinition}
          values={formSurface.values}
          pending={controller.pending}
          submitLabel={t("admin.createRole")}
          cancelLabel={t("admin.cancel")}
          onChange={(name, value) => formSurface.setValues((current) => {
            const next = { ...current, [name]: value };
            if (name === "name" && !current.customKey) next.roleKey = roleKeyFromName(value);
            if (name === "customKey" && !value) next.roleKey = roleKeyFromName(current.name);
            return next;
          })}
          onSubmit={submit}
          onClose={() => void formSurface.close()}
          surface={ROLE_CREATE_SURFACE}
        />
      )}
    </>
  );
}
