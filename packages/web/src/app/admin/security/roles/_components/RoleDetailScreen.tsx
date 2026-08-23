"use client";

/** Renders role metadata and permission assignment through the shared resource controller. */
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Alert, Skeleton } from "@/app/components/ui/feedback";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";
import { createRoleForm, createRoleResource, type RoleForm } from "./roleResource";

const EMPTY_ROLE_FORM: RoleForm = {
  roleKey: "",
  name: "",
  description: "",
  permissionIds: [],
};

/** Provides a reload-safe permission editor for one role. */
export function RoleDetailScreen({ roleKey }: { roleKey: string }) {
  const router = useRouter();
  const { t } = useAppLocale();
  const resource = useMemo(() => createRoleResource(t), [t]);
  const formDefinition = useMemo(() => createRoleForm(t), [t]);
  const controller = useAdminResourceController(resource, undefined);
  const formSurface = useAdminFormSurface<RoleForm>({
    moduleKey: resource.moduleKey,
    surfaceKey: `role-detail:${roleKey}`,
    surfaceKind: "modal",
    draftKey: `admin.roles.detail:${roleKey}`,
    formVersion: formDefinition.version,
    initialValues: EMPTY_ROLE_FORM,
    closePolicy: "preserve",
  });
  const detail = controller.detail;
  const isReadOnly = detail?.isSystem === true;

  useEffect(() => {
    void controller.controller.loadDetail(roleKey);
  }, [controller.controller, roleKey]);

  useEffect(() => {
    if (!detail || formSurface.isDirty) return;
    formSurface.setValues({
      roleKey: detail.roleKey,
      name: detail.name,
      description: detail.description,
      permissionIds: detail.permissions.map((permission) => permission.id),
    });
  }, [detail, formSurface]);

  const togglePermission = (permissionId: string, checked: boolean) => {
    formSurface.setValues((current) => ({
      ...current,
      permissionIds: checked
        ? [...new Set([...current.permissionIds, permissionId])]
        : current.permissionIds.filter((id) => id !== permissionId),
    }));
  };

  const save = async () => {
    if (!detail) return;
    const updated = await controller.controller.update(
      roleKey,
      formSurface.values,
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

  return (
    <section className="space-y-6">
      <header className="border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            {t("admin.roleDetail")}
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin/security/roles")}
            className="border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {t("admin.backToRoles")}
          </button>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {detail.name}
        </h1>
        <p className="mt-1 font-mono text-xs text-slate-500">{detail.roleKey}</p>
        <p className="mt-3 text-sm text-slate-600">
          {detail.description || t("admin.noDescription")}
        </p>
        {isReadOnly && (
          <Alert tone="info">{t("admin.systemRoleReadOnly")}</Alert>
        )}
      </header>
      {controller.detailError && (
        <Alert tone="danger">{controller.detailError.message}</Alert>
      )}
      {controller.error && <Alert tone="danger">{controller.error.message}</Alert>}
      <section className="border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              {t("admin.permissions")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("admin.permissionsDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isReadOnly || controller.pending || !formSurface.isDirty}
            className="bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {controller.pending ? t("admin.saving") : t("admin.savePermissions")}
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {detail.allAvailablePermissions.map((permission) => (
            <label
              key={permission.id}
              className="flex gap-3 border border-slate-200 p-3 text-sm"
            >
              <input
                type="checkbox"
                checked={formSurface.values.permissionIds.includes(permission.id)}
                disabled={isReadOnly}
                onChange={(event) =>
                  togglePermission(permission.id, event.target.checked)
                }
              />
              <span>
                <span className="block font-medium text-slate-800">
                  {permission.name}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {permission.permissionKey}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </section>
  );
}
