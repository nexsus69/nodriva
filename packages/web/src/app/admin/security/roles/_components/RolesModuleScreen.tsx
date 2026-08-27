"use client";

/** Composes the role collection from the reusable resource definition and controller. */
import type { FormEvent } from "react";
import { useMemo } from "react";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { AdminFormDialog } from "@/adminPanel/components/AdminFormDialog";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";
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

const EMPTY_ROLE: RoleForm = {
  roleKey: "",
  name: "",
  description: "",
  permissionIds: [],
  customKey: false,
};

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
  const controller = useAdminResourceController(resource, undefined);
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
    const created = await controller.controller.create(formSurface.values);
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
    onRefresh: () => void controller.reload(),
    pagination: { stateKey: resource.moduleKey },
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
