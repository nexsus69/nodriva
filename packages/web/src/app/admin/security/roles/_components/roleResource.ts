/** Defines localized role list, detail, and mutation adapters. */
import type { RoleDetailDto, RoleListItemDto } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import {
  createValidationMessages,
  defineForm,
  type FormDefinition,
} from "@/app/components/ui/forms";
import { defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { defineAdminSurface } from "@/adminPanel/AdminSurfaceDefinition";
import type { AdminTableColumn } from "@/adminPanel/components/AdminTable";

export type RoleForm = {
  roleKey: string;
  name: string;
  description: string;
  permissionIds: string[];
};

export type AdminTranslator = (key: string) => string;

export const ROLE_CREATE_SURFACE = defineAdminSurface({
  key: "role-create",
  moduleKey: "access.roles",
  tabs: [],
  initialTab: "",
  presentation: "drawer",
  placement: "right",
  appearance: "light",
  initialState: {},
});

export function createRoleForm(t: AdminTranslator): FormDefinition<RoleForm> {
  return defineForm({
    key: "admin.roles.form",
    version: "1",
    validationMessages: createValidationMessages(t),
    fields: [
      {
        name: "roleKey",
        label: t("admin.roleKey"),
        type: "text",
        description: t("admin.roleKeyHelp"),
        required: true,
        validation: {
          rules: [
            {
              kind: "pattern",
              value: "^[a-z0-9_]+$",
              message: t("admin.validationInvalid"),
            },
            { kind: "minLength", value: 2, message: t("admin.validationMin2") },
          ],
        },
        layout: { row: "identity", colSpan: 1, order: 1 },
      },
      {
        name: "name",
        label: t("admin.name"),
        type: "text",
        validation: {
          rules: [
            { kind: "minLength", value: 2, message: t("admin.validationMin2") },
          ],
        },
        required: true,
        layout: { row: "identity", colSpan: 1, order: 2 },
      },
      {
        name: "description",
        label: t("admin.description"),
        type: "textarea",
        rows: 3,
        layout: { row: "description", colSpan: 2, order: 1 },
      },
    ],
    sections: [
      {
        key: "identity",
        fieldNames: ["roleKey", "name"],
        columns: 2,
      },
      {
        key: "description",
        fieldNames: ["description"],
        columns: 2,
      },
    ],
    layout: { columns: 2, gap: "normal" },
  });
}

async function unwrap<T>(
  result: Promise<{ success: boolean; data?: T; error?: { message: string } }>,
): Promise<T> {
  const resolved = await result;
  if (!resolved.success || resolved.data === undefined) {
    throw new Error(resolved.error?.message ?? "Unable to load the role.");
  }
  return resolved.data;
}

export function createRoleResource(
  t: AdminTranslator,
): ReturnType<typeof defineAdminResource<RoleListItemDto, RoleDetailDto, RoleForm, undefined, string>> {
  const form = createRoleForm(t);
  const columns: readonly AdminTableColumn<RoleListItemDto>[] = [
    { key: "name", label: t("admin.name"), render: (row) => row.name },
    { key: "roleKey", label: t("admin.roleKey"), render: (row) => row.roleKey },
    {
      key: "permissions",
      label: t("admin.permissions"),
      render: (row) => row.permissionCount,
    },
  ];
  return defineAdminResource({
    key: "roles",
    moduleKey: "access.roles",
    label: t("admin.roles"),
    description: t("admin.rolesDescription"),
    permissions: {
      read: ["role.read"],
      create: ["role.create"],
      update: ["role.update"],
    },
    list: {
      load: async () => unwrap(AppCache.admin.listRoles()),
      columns,
      emptyLabel: t("admin.noRoles"),
      loadingLabel: t("admin.loadingRoles"),
    },
    detail: {
      load: (roleKey) => unwrap(AppCache.admin.getRoleByKey(roleKey)),
      form,
      create: async (input) =>
        unwrap(
          AppCache.admin.createRole({
            roleKey: input.roleKey.trim(),
            name: input.name.trim(),
            description: input.description.trim() || undefined,
            permissionIds: input.permissionIds,
          }),
        ),
      update: async (roleKey, input, expectedRowVersion) =>
        unwrap(
          AppCache.admin.updateRolePermissions({
            roleKey,
            permissionIds: input.permissionIds,
            expectedRowVersion: expectedRowVersion ?? 0,
          }),
        ),
    },
  });
}
