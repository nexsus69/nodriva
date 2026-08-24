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

/** Stores one boolean per permission so the shared renderer can own every control. */
export type RolePermissionForm = Record<string, unknown>;

/** Bumps persisted role-permission drafts when the form shape changes. */
export const ROLE_PERMISSION_FORM_VERSION = "2";

/** Produces a stable form field name without exposing storage-specific details. */
const permissionFieldName = (permissionId: string) => `permission:${permissionId}`;

/** Builds the shared definition for the dynamic permission checklist. */
export function createRolePermissionForm(
  t: AdminTranslator,
  permissions: readonly RoleDetailDto["allAvailablePermissions"][number][],
  readOnly = false,
): FormDefinition<RolePermissionForm> {
  return defineForm({
    key: "admin.roles.permissions.form",
    version: ROLE_PERMISSION_FORM_VERSION,
    validationMessages: createValidationMessages(t),
    fields: [
      { name: "name", type: "text" as const, label: t("admin.name"), required: true, disabled: readOnly, validation: { minLength: 2 }, layout: { row: "metadata", colSpan: 1 as const, order: 1 } },
      { name: "description", type: "textarea" as const, label: t("admin.description"), disabled: readOnly, rows: 3, layout: { row: "metadata", colSpan: 1 as const, order: 2 } },
      ...permissions.map((permission, index) => ({
      name: permissionFieldName(permission.id),
      type: "boolean" as const,
      label: permission.name,
      description: permission.permissionKey,
      disabled: readOnly,
      layout: {
        row: `permission-row-${Math.floor(index / 2)}`,
        colSpan: 1 as const,
        order: index % 2,
      },
      })),
    ],
    sections: [{
      key: "metadata",
      label: t("admin.roleDetail"),
      fieldNames: ["name", "description"],
      columns: 2,
    }, {
      key: "permissions",
      label: t("admin.permissions"),
      description: t("admin.permissionsDescription"),
      fieldNames: permissions.map((permission) => permissionFieldName(permission.id)),
      columns: 2,
    }],
    layout: { columns: 2, gap: "normal" },
  });
}

/** Creates an empty boolean value map for every permission in the detail payload. */
export function rolePermissionValues(
  permissions: readonly RoleDetailDto["allAvailablePermissions"][number][],
): RolePermissionForm {
  return Object.fromEntries(
    [["name", ""], ["description", ""], ...permissions.map((permission) => [permissionFieldName(permission.id), false])],
  );
}

/** Converts the renderer-owned boolean map back to the API permission id list. */
export function selectedRolePermissionIds(values: RolePermissionForm): string[] {
  return Object.entries(values)
    .filter(([fieldName, selected]) => fieldName.startsWith("permission:") && Boolean(selected))
    .map(([fieldName]) => fieldName.slice("permission:".length));
}

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
            { kind: "minLength", value: 2 },
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
            { kind: "minLength", value: 2 },
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
    { key: "name", label: t("admin.name"), render: (row) => row.name, sortValue: (row) => row.name },
    { key: "roleKey", label: t("admin.roleKey"), render: (row) => row.roleKey, sortValue: (row) => row.roleKey },
    {
      key: "permissions",
      label: t("admin.permissions"),
      render: (row) => row.permissionCount,
      sortValue: (row) => row.permissionCount,
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
          AppCache.admin.updateRole({
            roleKey,
            name: input.name.trim(),
            description: input.description.trim() || undefined,
            permissionIds: input.permissionIds,
            expectedRowVersion: expectedRowVersion ?? 0,
          }),
        ),
    },
  });
}
