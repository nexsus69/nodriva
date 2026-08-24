"use client";

/** Renders role metadata and permission assignment through the shared resource controller. */
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Alert, Skeleton } from "@/app/components/ui/feedback";
import { FormRenderer } from "@/app/components/ui/forms";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";
import {
  createRolePermissionForm,
  createRoleResource,
  rolePermissionValues,
  ROLE_PERMISSION_FORM_VERSION,
  selectedRolePermissionIds,
  type RolePermissionForm,
} from "./roleResource";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { canUseAdminResourceOperation } from "@/adminPanel/AdminResourceDefinition";
import { AdminButton } from "@/adminPanel/components/AdminButton";
import { AdminPageHeader } from "@/adminPanel/components/AdminPageHeader";

/** Provides a reload-safe permission editor for one role. */
export function RoleDetailScreen({ roleKey, onClose }: { roleKey: string; onClose?: () => void }) {
  const router = useRouter();
  const { t } = useAppLocale();
  const resource = useMemo(() => createRoleResource(t), [t]);
  const authorization = useAdminAuthorization();
  const controller = useAdminResourceController(resource, undefined);
  const detail = controller.detail;
  const initialValues = useMemo(() => detail ? {
    ...rolePermissionValues(detail.allAvailablePermissions),
    name: detail.name,
    description: detail.description,
    ...Object.fromEntries(detail.permissions.map((permission) => [`permission:${permission.id}`, true])),
  } : {}, [detail]);
  const formSurface = useAdminFormSurface<RolePermissionForm>({
    moduleKey: resource.moduleKey,
    surfaceKey: `role-detail:${roleKey}`,
    surfaceKind: "modal",
    draftKey: `admin.roles.detail:${roleKey}`,
    formVersion: ROLE_PERMISSION_FORM_VERSION,
    initialValues,
    closePolicy: "discard",
    confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"),
    confirmDescription: t("admin.discardDescription"),
    confirmConfirmLabel: t("admin.discardChanges"),
    confirmCancelLabel: t("admin.keepEditing"),
  });
  const isReadOnly = detail?.isSystem === true;
  const canUpdate = canUseAdminResourceOperation(resource, "update", authorization.permissions);
  const formDefinition = useMemo(
    () => detail
      ? createRolePermissionForm(t, detail.allAvailablePermissions, isReadOnly)
      : undefined,
    [detail, isReadOnly, t],
  );

  useEffect(() => {
    void controller.controller.loadDetail(roleKey);
  }, [controller.controller, roleKey]);

  const save = async () => {
    if (!detail) return;
    const updated = await controller.controller.update(
      roleKey,
      {
        roleKey: detail.roleKey,
        name: String(formSurface.values.name ?? "").trim(),
        description: String(formSurface.values.description ?? "").trim(),
        permissionIds: selectedRolePermissionIds(formSurface.values),
      },
      detail.rowVersion,
    );
    if (updated) formSurface.complete();
  };

  if (controller.detailLoading) {
    return (
      <section className="space-y-4 border border-slate-200 bg-white p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="space-y-4 border border-slate-200 bg-white p-6">
        <Alert tone="danger">
          {controller.detailError?.message ?? t("admin.roleNotFound")}
        </Alert>
      </section>
    );
  }

  /** Returns to the role collection only after the shared form lifecycle approves the close. */
  const returnToList = async () => {
    if (!(await formSurface.close())) return;
    if (onClose) onClose();
    else router.push("/admin/security/roles");
  };

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title={detail.name}
        description={detail.description || t("admin.noDescription")}
        icon="roles"
        breadcrumbs={[{ label: t("admin.roles"), onClick: () => void returnToList() }]}
        actions={(
          <AdminButton tone="secondary" icon="arrow-left" onClick={() => void returnToList()}>
            {t("admin.backToRoles")}
          </AdminButton>
        )}
      />
      <p className="font-mono text-xs text-slate-500">{detail.roleKey}</p>
      {isReadOnly && <Alert tone="info">{t("admin.systemRoleReadOnly")}</Alert>}
      {controller.detailError && (
        <Alert tone="danger">{controller.detailError.message}</Alert>
      )}
      {controller.error && <Alert tone="danger">{controller.error.message}</Alert>}
      {formDefinition && (
        <section className="border border-slate-200 bg-white p-6">
          <FormRenderer
            definition={formDefinition}
            values={formSurface.values}
            onChange={(name, value) =>
              formSurface.setValues((current) => ({
                ...current,
                [name]: value,
              }))
            }
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            isPending={controller.pending}
            submitDisabled={isReadOnly || !canUpdate || !formSurface.isDirty}
            submitLabel={t("admin.savePermissions")}
            pendingLabel={t("admin.saving")}
            cancelLabel={t("admin.backToRoles")}
            onCancel={() => void returnToList()}
            theme="light"
          />
        </section>
      )}
    </section>
  );
}
