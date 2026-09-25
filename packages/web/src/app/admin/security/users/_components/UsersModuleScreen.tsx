"use client";

/** Composes the user collection and scoped user provisioning workflow. */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RoleListItemDto, ScopeAssignmentDto, UserListItemDto } from "@dashboard/core";
import { isUserPasswordValid } from "@dashboard/core/browser";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import {
  createValidationMessages,
  defineForm,
  type FormDefinition,
  PasswordRequirements,
} from "@/app/components/ui/forms";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { AdminFormDialog } from "@/adminPanel/components/AdminFormDialog";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAdminRepeatableRows } from "@/adminPanel/useAdminRepeatableRows";
import { canUseAdminResourceOperation, defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { loadVisibleScopeNodes, type ScopeNodeOption } from "@/app/admin/security/scopeNodeOptions";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { UserDetailScreen } from "./UserDetailScreen";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { AdminStatusBadge } from "@/adminPanel/components/AdminStatusBadge";
import { useAdminRemotePagination } from "@/adminPanel/useAdminRemotePagination";
import { useAdminRealtimeCollectionRefresh } from "@/adminPanel/useAdminRealtimeCollectionRefresh";
import { useAdminCollectionMutation } from "@/adminPanel/useAdminCollectionMutation";
import type { AdminTableSortState } from "@/adminPanel/components/AdminTable";

/** Stores the identity fields and mandatory initial scope fields. */
type UserCreateForm = Record<string, unknown>;

/** Limits role options to the labels needed by the provisioning form. */
type RoleOption = Pick<RoleListItemDto, "id" | "name">;

/** Starts every new provisioning form with no user or scope selected. */
const EMPTY_USER: UserCreateForm = {
  email: "",
  password: "",
  "assignment.1.roleId": "",
  "assignment.1.nodeId": "",
  "assignment.1.propagation": "subtree",
};

/** Creates the value key for one field in a repeatable assignment row. */
function assignmentFieldName(rowId: string, field: "roleId" | "nodeId" | "propagation"): string {
  return `assignment.${rowId}.${field}`;
}

/** Builds the shared provisioning form with a mandatory initial role scope. */
function createUserForm(
  t: (key: string) => string,
  roles: readonly RoleOption[],
  nodes: readonly ScopeNodeOption[],
  assignmentRowIds: readonly string[],
  nodesLoading: boolean,
): FormDefinition<UserCreateForm> {
  const assignmentFields = assignmentRowIds.flatMap((rowId, index) => {
    const rowKey = `assignment-${rowId}`;
    return [
      {
        name: assignmentFieldName(rowId, "roleId"),
        type: "select" as const,
        label: t("admin.role"),
        required: index === 0,
        options: roles.map((role) => ({ value: role.id, label: role.name })),
        layout: { row: rowKey, colSpan: 1 as const, order: 1 },
      },
      {
        name: assignmentFieldName(rowId, "nodeId"),
        type: "nodeTree" as const,
        label: t("admin.node"),
        required: index === 0,
        nodes,
        loading: nodesLoading,
        interaction: "both" as const,
        labels: {
          instruction: t("admin.scopeTreeInstruction"),
          empty: t("admin.scopeTreeEmpty"),
          loading: t("admin.scopeTreeLoading"),
          dropPlaceholder: t("admin.scopeTreeDropPlaceholder"),
          expand: t("admin.scopeTreeExpand"),
          collapse: t("admin.scopeTreeCollapse"),
        },
        layout: {
          row: `${rowKey}-node`,
          colSpan: 2 as const,
          order: 1,
        },
      },
      {
        name: assignmentFieldName(rowId, "propagation"),
        type: "select" as const,
        label: t("admin.propagation"),
        required: index === 0,
        options: [
          { value: "self", label: t("admin.self") },
          { value: "subtree", label: t("admin.subtree") },
        ],
        layout: { row: rowKey, colSpan: 1 as const, order: 3 },
      },
    ];
  });
  const assignmentSections = assignmentRowIds.map((rowId, index) => ({
    key: `assignment-${rowId}`,
    label: `${t("admin.scopeTarget")} ${index + 1}`,
    fieldNames: [
      assignmentFieldName(rowId, "roleId"),
      assignmentFieldName(rowId, "nodeId"),
      assignmentFieldName(rowId, "propagation"),
    ],
    columns: 2 as const,
  }));
  return defineForm({
    key: "admin.users.create",
    version: `4-${assignmentRowIds.join("-")}`,
    validationMessages: createValidationMessages(t),
    fields: [
      {
        name: "email",
        type: "email",
        label: t("admin.email"),
        required: true,
        validation: { email: true },
        layout: { row: "identity", colSpan: 2, order: 1 },
      },
      {
        name: "password",
        type: "password",
        label: t("admin.password"),
        required: true,
        validation: { minLength: 12 },
        layout: { row: "identity", colSpan: 2, order: 2 },
      },
      ...assignmentFields,
    ],
    sections: [
      {
        key: "identity",
        label: t("admin.identity"),
        fieldNames: ["email", "password"],
    columns: 2 as const,
      },
      ...assignmentSections,
    ],
    layout: { columns: 2, gap: "normal" },
  });
}

/** Owns server-paged user reads; list membership is never derived in the browser. */
function useUsersRemoteCoordinator() {
  const moduleKey = "access.users";
  const moduleState = useAdminWorkspaceStore((state) => state.moduleState[moduleKey]);
  const setModuleState = useAdminWorkspaceStore((state) => state.setModuleState);
  const [rows, setRows] = useState<readonly UserListItemDto[]>([]);
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
    const acceptedSort = sort && ["email", "status", "createdAt"].includes(sort.columnKey)
      ? { key: sort.columnKey as "email" | "status" | "createdAt", direction: sort.direction }
      : undefined;
    try {
      const page = await AppCache.users.listUsersPage({ page: requestedPage, pageSize, search: search.trim() || undefined, sort: acceptedSort });
      if (request !== version.current) return;
      setRows(page.items);
      setTotal(page.total);
      setPage(page.page);
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
  useAdminRealtimeCollectionRefresh(["users"], () => load(currentPage));
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

/** Provides user creation with an atomic initial role and node scope. */
export function UsersModuleScreen() {
  const { t } = useAppLocale();
  const selectedResource = useAdminWorkspaceStore((state) => state.selectedResource);
  const selectResource = useAdminWorkspaceStore((state) => state.selectResource);
  const authorization = useAdminAuthorization();
  const [roles, setRoles] = useState<readonly RoleOption[]>([]);
  const [nodes, setNodes] = useState<readonly ScopeNodeOption[]>([]);
  const [nodesLoading, setNodesLoading] = useState(true);
  const assignmentRows = useAdminRepeatableRows({
    moduleKey: "access.users",
    stateKey: "createAssignmentRowIds",
  });
  const resource = useMemo(() => defineAdminResource<UserListItemDto>({
    key: "users",
    moduleKey: "access.users",
    label: t("admin.users"),
    description: t("admin.usersDescription"),
    permissions: {
      read: ["user.read"],
      create: ["user.create"],
      update: ["user.update"],
      delete: ["user.delete"],
    },
    list: {
      mode: "remote",
      realtimeDependencies: ["users"],
      columns: [
        { key: "email", label: t("admin.email"), render: (row) => row.email, sortValue: (row) => row.email },
        {
          key: "status",
          label: t("admin.status"),
          render: (row) => (
            <AdminStatusBadge tone={row.isActive ? "success" : "neutral"}>
              {row.isActive ? t("admin.active") : t("admin.disabled")}
            </AdminStatusBadge>
          ),
          sortValue: (row) => row.isActive,
        },
        {
          key: "roles",
          label: t("admin.roles"),
          render: (row) => row.roles.map((role) => role.name).join(", ") || "—",
        },
      ],
      emptyLabel: t("admin.noUsers"),
      loadingLabel: t("admin.loadingUsers"),
    },
  }), [t]);
  const collection = useUsersRemoteCoordinator();
  const canCreate = canUseAdminResourceOperation(resource, "create", authorization.permissions);
  const canUpdate = canUseAdminResourceOperation(resource, "update", authorization.permissions);
  const definition = useMemo(
    () => createUserForm(t, roles, nodes, assignmentRows.rowIds, nodesLoading),
    [assignmentRows.rowIds, nodes, nodesLoading, roles, t],
  );
  const formSurface = useAdminFormSurface<UserCreateForm>({
    moduleKey: resource.moduleKey,
    surfaceKey: "user-create",
    surfaceKind: "modal",
    draftKey: "admin.users.create",
    formVersion: definition.version,
    initialValues: EMPTY_USER,
    closePolicy: "discard",
    confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"),
    confirmDescription: t("admin.discardDescription"),
    confirmConfirmLabel: t("admin.discardChanges"),
    confirmCancelLabel: t("admin.keepEditing"),
  });

  /** Adds a new optional role-scope row to the provisioning form. */
  const addAssignmentRow = () => {
    assignmentRows.add();
  };

  /** Removes an optional row while retaining the mandatory first assignment. */
  const removeAssignmentRow = (rowId: string) => {
    if (assignmentRows.rowIds.length === 1) return;
    assignmentRows.remove(rowId);
    formSurface.setValues((current) => {
      const next = { ...current };
      delete next[assignmentFieldName(rowId, "roleId")];
      delete next[assignmentFieldName(rowId, "nodeId")];
      delete next[assignmentFieldName(rowId, "propagation")];
      return next;
    });
  };

  useEffect(() => {
    void Promise.all([
      AppCache.admin.listRoles(),
      AppCache.admin.listScopeAssignments(),
      loadVisibleScopeNodes(),
    ]).then(([roleResult, scopeResult, nodeResult]) => {
      if (roleResult.success && roleResult.data) {
        setRoles(roleResult.data.map((role) => ({ id: role.id, name: role.name })));
      } else if (scopeResult.success && scopeResult.data) {
        const roleOptions = new Map<string, RoleOption>();
        for (const assignment of scopeResult.data as ScopeAssignmentDto[]) {
          roleOptions.set(assignment.roleId, { id: assignment.roleId, name: assignment.roleName });
        }
        setRoles([...roleOptions.values()]);
      }
      setNodes(nodeResult);
      setNodesLoading(false);
    }).catch(() => {
      setNodesLoading(false);
    });
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isUserPasswordValid(String(formSurface.values.password ?? ""))) return;
    const assignments = assignmentRows.rowIds.map((rowId) => ({
      nodeId: String(formSurface.values[assignmentFieldName(rowId, "nodeId")] ?? ""),
      roleId: String(formSurface.values[assignmentFieldName(rowId, "roleId")] ?? ""),
      propagation: String(
        formSurface.values[assignmentFieldName(rowId, "propagation")] ?? "subtree",
      ) as "self" | "subtree",
    })).filter((assignment) => assignment.nodeId && assignment.roleId);
    await formSurface.submitMutation(async () => {
          await AppCache.users.createScopedUser({
            email: String(formSurface.values.email ?? "").trim(),
            password: String(formSurface.values.password ?? ""),
            assignments,
          });
          await collection.load();
        }, () => {
      formSurface.complete();
      assignmentRows.reset();
    });
  };

  /** Closes the form and resets repeatable rows only after a confirmed discard. */
  const closeCreateForm = async () => {
    if (await formSurface.close()) assignmentRows.reset();
  };

  const collectionDefinition: AdminCollectionDefinition<UserListItemDto> = {
    title: resource.label,
    description: resource.description,
    icon: "users",
    columns: resource.list.columns,
    loadingLabel: resource.list.loadingLabel,
    emptyLabel: resource.list.emptyLabel,
    rows: collection.rows,
    loading: collection.loading,
    error: collection.error,
    mutationFailure: collection.mutationFailure,
    onRetryMutation: collection.retryMutation,
    createLabel: canCreate ? t("admin.createUser") : undefined,
    onCreate: canCreate ? () => formSurface.open({ mode: "create" }) : undefined,
    onOpen: (row) => selectResource({ moduleKey: resource.moduleKey, resourceId: row.id }),
    rowLabel: (row) => row.email,
    actionMenuLabel: t("admin.actions"),
    refreshLabel: t("admin.refresh"),
    onRefresh: () => void collection.load(collection.pagination.page),
    search: { value: collection.search, label: "Cerca utenti", placeholder: "Cerca utenti", onChange: collection.setSearch },
    pagination: { mode: "remote", page: collection.pagination.page, pageCount: collection.pagination.pageCount, onPageChange: (page) => void collection.load(page), sort: collection.sort, onSortChange: collection.setSort },
    actions: [
      {
        key: "toggle-status",
        label: t("admin.toggleStatus"),
        tone: "primary",
        onClick: (row) => {
          void collection.execute(async () => {
                const detail = await AppCache.users.getUser(row.id);
                await AppCache.users.updateUserStatus({
                  userId: row.id,
                  isActive: !detail.isActive,
                  expectedRowVersion: detail.rowVersion,
                });
              });
        },
        hidden: () => !canUpdate,
      },
    ],
  };

  if (selectedResource?.moduleKey === resource.moduleKey && selectedResource.resourceId) {
    return <UserDetailScreen userId={selectedResource.resourceId} onClose={() => selectResource(null)} />;
  }

  return (
    <>
      <AdminCollectionScreen definition={collectionDefinition} />
      {formSurface.isOpen && (
        <AdminFormDialog
          title={t("admin.createUser")}
          definition={definition}
          values={formSurface.values}
          pending={formSurface.isSubmitting}
          submitDisabled={!isUserPasswordValid(String(formSurface.values.password ?? ""))}
          submitLabel={t("admin.createUser")}
          cancelLabel={t("admin.cancel")}
          onChange={(name, value) => formSurface.setValues((current) => ({ ...current, [name]: value }))}
          onSubmit={(event) => void submit(event)}
          onClose={() => void closeCreateForm()}
          mutationFailure={formSurface.mutationFailure}
          onRetryMutation={formSurface.retryMutation}
        >
          <PasswordRequirements password={String(formSurface.values.password ?? "")} />
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">{t("admin.userScopeRequired")}</p>
            <div className="flex gap-2">
              <button type="button" onClick={addAssignmentRow} className="px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
                + {t("admin.addScopeAssignment")}
              </button>
              {assignmentRows.rowIds.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAssignmentRow(
                    assignmentRows.rowIds[assignmentRows.rowIds.length - 1]!,
                  )}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  − {t("admin.removeScopeAssignment")}
                </button>
              )}
            </div>
          </div>
        </AdminFormDialog>
      )}
    </>
  );
}
