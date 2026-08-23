"use client";

/** Composes the role collection from the reusable resource definition and controller. */
import type { FormEvent } from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
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

const EMPTY_ROLE: RoleForm = {
  roleKey: "",
  name: "",
  description: "",
  permissionIds: [],
};

/** Renders the complete role list and create flow without owning resource lifecycle state. */
export function RolesModuleScreen() {
  const router = useRouter();
  const { t } = useAppLocale();
  const resource = useMemo(() => createRoleResource(t), [t]);
  const formDefinition = useMemo(() => createRoleForm(t), [t]);
  const controller = useAdminResourceController(resource, undefined);
  const formSurface = useAdminFormSurface<RoleForm>({
    moduleKey: resource.moduleKey,
    surfaceKey: ROLE_CREATE_SURFACE.key,
    surfaceKind: ROLE_CREATE_SURFACE.presentation,
    draftKey: "admin.roles.create",
    formVersion: formDefinition.version,
    initialValues: EMPTY_ROLE,
    closePolicy: "discard",
    confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"),
    confirmDescription: t("admin.discardDescription"),
    confirmConfirmLabel: t("admin.discardChanges"),
    confirmCancelLabel: t("admin.keepEditing"),
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await controller.controller.create(formSurface.values);
    if (created) formSurface.complete();
  };

  const definition: AdminCollectionDefinition<(typeof controller.rows)[number]> = {
    title: resource.label,
    description: resource.description,
    columns: resource.list.columns,
    loadingLabel: resource.list.loadingLabel,
    emptyLabel: resource.list.emptyLabel,
    rows: controller.rows,
    loading: controller.loading,
    error: controller.error,
    createLabel: t("admin.createRole"),
    onCreate: formSurface.open,
    actions: [
      {
        key: "open",
        label: t("admin.open"),
        tone: "primary",
        onClick: (row) => router.push(`/admin/security/roles/${row.roleKey}`),
      },
    ],
  };

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
          onChange={(name, value) =>
            formSurface.setValues((current) => ({
              ...current,
              [name]: value,
            }))
          }
          onSubmit={submit}
          onClose={() => void formSurface.close()}
          surface={ROLE_CREATE_SURFACE}
        />
      )}
    </>
  );
}
