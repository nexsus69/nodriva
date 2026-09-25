"use client";

/** Composes scope assignments and their definition-driven creation workflow. */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RoleListItemDto, ScopeAssignmentDto, UserListItemDto } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { requestConfirmation } from "@/app/components/ui/feedback/ConfirmDialogStore";
import {
  createValidationMessages,
  defineForm,
  type FormDefinition,
} from "@/app/components/ui/forms";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { AdminFormDialog } from "@/adminPanel/components/AdminFormDialog";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { canUseAdminResourceOperation, defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { loadVisibleScopeNodes, type ScopeNodeOption } from "@/app/admin/security/scopeNodeOptions";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { useAdminRemotePagination } from "@/adminPanel/useAdminRemotePagination";
import { useAdminRealtimeCollectionRefresh } from "@/adminPanel/useAdminRealtimeCollectionRefresh";
import { useAdminCollectionMutation } from "@/adminPanel/useAdminCollectionMutation";
import type { AdminTableSortState } from "@/adminPanel/components/AdminTable";

type ScopeForm = { userId: string; nodeId: string; roleId: string; assignmentEffect: string; propagation: string };
const EMPTY_SCOPE: ScopeForm = { userId: "", nodeId: "", roleId: "", assignmentEffect: "allow", propagation: "subtree" };

/** Owns only remote scope query state; membership and ordering remain backend-authoritative. */
function useScopesRemoteCoordinator() {
  const moduleKey = "access.scopes";
  const moduleState = useAdminWorkspaceStore((state) => state.moduleState[moduleKey]);
  const setModuleState = useAdminWorkspaceStore((state) => state.setModuleState);
  const [rows, setRows] = useState<readonly ScopeAssignmentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sort, setSortState] = useState<AdminTableSortState | null>(null);
  const version = useRef(0);
  const search = typeof moduleState?.search === "string" ? moduleState.search : "";
  const pagination = useAdminRemotePagination({ total, stateKey: moduleKey });
  const { page: currentPage, pageSize, setPage, reset } = pagination;
  const load = useCallback(async (requestedPage = currentPage) => {
    const request = ++version.current;
    setLoading(true);
    setError(null);
    const acceptedSort = sort && ["user", "node", "role", "assignedAt"].includes(sort.columnKey)
      ? { key: sort.columnKey as "user" | "node" | "role" | "assignedAt", direction: sort.direction }
      : undefined;
    try {
      const response = await AppCache.adminScopes.read({
        page: requestedPage,
        pageSize,
        search: search.trim() || undefined,
        sort: acceptedSort,
      });
      if (request !== version.current) return;
      setRows(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (reason) {
      if (request === version.current) setError(reason instanceof Error ? reason : new Error(String(reason)));
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [currentPage, pageSize, search, setPage, sort]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useAdminRealtimeCollectionRefresh(["scope-assignments"], () => load(currentPage));
  const setSearch = useCallback((next: string) => {
    reset();
    setModuleState(moduleKey, { search: next });
  }, [reset, setModuleState]);
  const setSort = useCallback((next: AdminTableSortState) => {
    reset();
    setSortState(next);
  }, [reset]);
  const mutation = useAdminCollectionMutation(() => load());
  return { rows, loading, error, search, setSearch, sort, setSort, pagination, load, ...mutation };
}

/** Builds the shared scope assignment form from currently authorized choices. */
function createScopeForm(
  t: (key: string) => string,
  users: readonly UserListItemDto[],
  roles: readonly RoleListItemDto[],
  nodes: readonly ScopeNodeOption[],
  nodesLoading: boolean,
): FormDefinition<ScopeForm> {
  return defineForm({
    key: "admin.scopes.create",
    version: "1",
    validationMessages: createValidationMessages(t),
    fields: [
      { name: "userId", type: "select", label: t("admin.user"), required: true, options: users.map((user) => ({ value: user.id, label: user.email })), layout: { row: "target", colSpan: 1, order: 1 } },
      { name: "roleId", type: "select", label: t("admin.role"), required: true, options: roles.map((role) => ({ value: role.id, label: role.name })), layout: { row: "target", colSpan: 1, order: 2 } },
      {
        name: "nodeId",
        type: "nodeTree",
        label: t("admin.node"),
        required: true,
        nodes,
        loading: nodesLoading,
        interaction: "both",
        labels: {
          instruction: t("admin.scopeTreeInstruction"),
          empty: t("admin.scopeTreeEmpty"),
          loading: t("admin.scopeTreeLoading"),
          dropPlaceholder: t("admin.scopeTreeDropPlaceholder"),
          expand: t("admin.scopeTreeExpand"),
          collapse: t("admin.scopeTreeCollapse"),
        },
        layout: { row: "node", colSpan: 2, order: 1 },
      },
      { name: "assignmentEffect", type: "select", label: t("admin.effect"), required: true, options: [{ value: "allow", label: t("admin.allow") }, { value: "deny", label: t("admin.deny") }], layout: { row: "policy", colSpan: 1, order: 1 } },
      { name: "propagation", type: "select", label: t("admin.propagation"), required: true, options: [{ value: "self", label: t("admin.self") }, { value: "subtree", label: t("admin.subtree") }], layout: { row: "policy", colSpan: 1, order: 2 } },
    ],
    sections: [
      {
        key: "target",
        label: t("admin.scopeTarget"),
        fieldNames: ["userId", "roleId", "nodeId"],
        columns: 2,
      },
      { key: "policy", label: t("admin.scopePolicy"), fieldNames: ["assignmentEffect", "propagation"], columns: 2 },
    ],
    layout: { columns: 2, gap: "normal" },
  });
}

/** Provides the complete scope assignment creation flow using shared controls. */
export function ScopesModuleScreen() {
  const { t } = useAppLocale();
  const authorization = useAdminAuthorization();
  const [users, setUsers] = useState<readonly UserListItemDto[]>([]);
  const [roles, setRoles] = useState<readonly RoleListItemDto[]>([]);
  const [nodes, setNodes] = useState<readonly ScopeNodeOption[]>([]);
  const [nodesLoading, setNodesLoading] = useState(true);
  const resource = useMemo(() => defineAdminResource<ScopeAssignmentDto>({
    key: "scopes",
    moduleKey: "access.scopes",
    label: t("admin.scopes"),
    description: t("admin.scopesDescription"),
    permissions: {
      read: ["scope.read"],
      create: ["scope.assign"],
      update: ["scope.assign"],
      delete: ["scope.delete"],
    },
    list: {
      mode: "remote",
      realtimeDependencies: ["scope-assignments"],
      columns: [
        { key: "user", label: t("admin.user"), render: (row) => row.userEmail, sortValue: (row) => row.userEmail },
        { key: "node", label: t("admin.node"), render: (row) => row.nodeName, sortValue: (row) => row.nodeName },
        { key: "role", label: t("admin.role"), render: (row) => row.roleName, sortValue: (row) => row.roleName },
        { key: "propagation", label: t("admin.propagation"), render: (row) => row.propagation, sortValue: (row) => row.propagation },
      ],
      emptyLabel: t("admin.noScopes"),
      loadingLabel: t("admin.loadingScopes"),
    },
  }), [t]);
  const collection = useScopesRemoteCoordinator();
  const definition = useMemo(
    () => createScopeForm(t, users, roles, nodes, nodesLoading),
    [nodes, nodesLoading, roles, t, users],
  );
  const formSurface = useAdminFormSurface<ScopeForm>({
    moduleKey: resource.moduleKey,
    surfaceKey: "scope-create",
    surfaceKind: "modal",
    draftKey: "admin.scopes.create",
    formVersion: definition.version,
    initialValues: EMPTY_SCOPE,
    closePolicy: "discard",
    confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"),
    confirmDescription: t("admin.discardDescription"),
    confirmConfirmLabel: t("admin.discardChanges"),
    confirmCancelLabel: t("admin.keepEditing"),
  });
  const editing = formSurfaceResource(collection.rows);
  const canCreate = canUseAdminResourceOperation(resource, "create", authorization.permissions);
  const canUpdate = canUseAdminResourceOperation(resource, "update", authorization.permissions);
  const canDelete = canUseAdminResourceOperation(resource, "delete", authorization.permissions);
  useEffect(() => {
    void Promise.all([
      AppCache.users.listUsers(),
      AppCache.admin.listRoles(),
      loadVisibleScopeNodes(),
    ]).then(([userRows, roleResult, nodeResult]) => {
      setUsers(userRows);
      if (roleResult.success && roleResult.data) setRoles(roleResult.data);
      setNodes(nodeResult);
      setNodesLoading(false);
    }).catch(() => {
      setNodesLoading(false);
    });
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = {
      userId: formSurface.values.userId,
      nodeId: formSurface.values.nodeId,
      roleId: formSurface.values.roleId,
      assignmentEffect: formSurface.values.assignmentEffect as "allow" | "deny",
      propagation: formSurface.values.propagation as "self" | "subtree",
    };
    await formSurface.submitMutation(async () => {
      const result = editing
        ? await AppCache.admin.updateScopeAssignment({ assignmentId: editing.id, roleId: values.roleId, assignmentEffect: values.assignmentEffect, propagation: values.propagation })
        : await AppCache.admin.createScopeAssignment(values);
      if (!result.success) throw result.error ?? { code: "INTERNAL_ERROR", message: t("admin.loadingScopes") };
      await collection.load();
    }, formSurface.complete);
  };
  const openCreate = () => {
    formSurface.complete();
    formSurface.open({ mode: "create" });
  };
  const openEdit = (row: ScopeAssignmentDto) => {
    formSurface.complete();
    formSurface.initialize({ userId: row.userId, nodeId: row.nodeId, roleId: row.roleId, assignmentEffect: row.assignmentEffect, propagation: row.propagation });
    formSurface.open({ mode: "edit", resourceId: row.id });
  };
  const remove = async (row: ScopeAssignmentDto) => {
    const confirmed = await requestConfirmation({
      title: t("admin.deleteScopeTitle"),
      description: t("admin.deleteScopeDescription"),
      confirmLabel: t("admin.delete"),
      cancelLabel: t("admin.cancel"),
      tone: "danger",
    });
    if (!confirmed) return;
    await collection.execute(async () => {
      const result = await AppCache.admin.deleteScopeAssignment({ assignmentId: row.id });
      if (!result.success) throw result.error ?? { code: "INTERNAL_ERROR", message: t("admin.deleteScopeTitle") };
    });
  };
  const collectionDefinition: AdminCollectionDefinition<ScopeAssignmentDto> = {
    title: resource.label,
    description: resource.description,
    icon: "scope",
    columns: resource.list.columns,
    loadingLabel: resource.list.loadingLabel,
    emptyLabel: resource.list.emptyLabel,
    rows: collection.rows,
    loading: collection.loading,
    error: collection.error,
    mutationFailure: collection.mutationFailure,
    onRetryMutation: collection.retryMutation,
    createLabel: canCreate ? t("admin.createScope") : undefined,
    onCreate: canCreate ? openCreate : undefined,
    onOpen: canUpdate ? openEdit : undefined,
    rowLabel: (row) => `${row.userEmail} · ${row.nodeName}`,
    actionMenuLabel: t("admin.actions"),
    refreshLabel: t("admin.refresh"),
    onRefresh: () => void collection.load(collection.pagination.page),
    search: { value: collection.search, label: "Cerca assegnazioni", placeholder: "Cerca assegnazioni", onChange: collection.setSearch },
    pagination: {
      mode: "remote",
      page: collection.pagination.page,
      pageCount: collection.pagination.pageCount,
      onPageChange: (page) => void collection.load(page),
      sort: collection.sort,
      onSortChange: collection.setSort,
    },
    actions: [
      { key: "edit", label: t("admin.edit"), tone: "primary", onClick: openEdit, hidden: () => !canUpdate },
      { key: "delete", label: t("admin.delete"), tone: "danger", onClick: (row) => void remove(row), hidden: () => !canDelete },
    ],
  };
  return (
    <>
      <AdminCollectionScreen definition={collectionDefinition} />
      {formSurface.isOpen && (
        <AdminFormDialog
          title={editing ? t("admin.editScope") : t("admin.createScope")}
          definition={definition}
          values={formSurface.values}
          pending={formSurface.isSubmitting}
          submitLabel={editing ? t("admin.saveChanges") : t("admin.createScope")}
          cancelLabel={t("admin.cancel")}
          onChange={(name, value) => formSurface.setValues((current) => ({ ...current, [name]: String(value) }))}
          onSubmit={(event) => void submit(event)}
          onClose={() => void formSurface.close()}
          mutationFailure={formSurface.mutationFailure}
          onRetryMutation={formSurface.retryMutation}
        />
      )}
    </>
  );

  function formSurfaceResource(
    rows: readonly ScopeAssignmentDto[],
  ): ScopeAssignmentDto | null {
    if (formSurface.mode !== "edit" || !formSurface.resourceId) return null;
    return rows.find((row) => row.id === formSurface.resourceId) ?? null;
  }
}
