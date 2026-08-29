"use client";

/** Composes capability and system-setting collections with shared edit forms. */
import { useMemo, type FormEvent } from "react";
import type { RuntimeCapabilityDto, SystemSettingDto } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { createValidationMessages, defineForm, type FormDefinition, type FormFieldSchema } from "@/app/components/ui/forms";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { AdminFormDialog } from "@/adminPanel/components/AdminFormDialog";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";
import { canUseAdminResourceOperation, defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";

type SystemRow = RuntimeCapabilityDto | SystemSettingDto;
type SystemForm = { status?: string; valueText?: string };

/** Defines the status/value form used by both editable system collections. */
function systemForm(t: (key: string) => string, key: "capabilities" | "settings", setting?: SystemSettingDto): FormDefinition<SystemForm> {
  const fields: FormFieldSchema[] = key === "capabilities"
    ? [{ name: "status", type: "select", label: t("admin.status"), required: true, options: [{ value: "enabled", label: t("admin.enabled") }, { value: "disabled", label: t("admin.disabled") }, { value: "optional", label: t("admin.optional") }] }]
    : [systemSettingField(t, setting)];
  return defineForm({
    key: `admin.system.${key}.form`,
    version: "1",
    validationMessages: createValidationMessages(t),
    fields,
    layout: { columns: 1, gap: "normal" },
  });
}

/** Maps each setting value type to one unambiguous shared form field. */
function systemSettingField(
  t: (key: string) => string,
  setting?: SystemSettingDto,
): FormFieldSchema {
  const common = {
    name: "valueText",
    label: setting?.displayName ?? t("admin.value"),
    required: true,
    description: setting?.description,
  };
  if (setting?.valueType === "json") return { ...common, type: "textarea", rows: 4 };
  if (setting?.valueType === "boolean") {
    return {
      ...common,
      type: "select",
      options: [{ value: "true", label: "true" }, { value: "false", label: "false" }],
    };
  }
  if (setting?.valueType === "integer" || setting?.valueType === "decimal") {
    return { ...common, type: "number" };
  }
  return { ...common, type: "text" };
}

/** Provides editable capability and setting collections through one screen contract. */
export function SystemConfigModuleScreen({ kind }: { kind: "capabilities" | "settings" }) {
  const { t } = useAppLocale();
  const authorization = useAdminAuthorization();
  const resource = useMemo(() => defineAdminResource<SystemRow>({
    key: kind,
    moduleKey: `system.${kind}`,
    label: kind === "capabilities" ? t("admin.capabilities") : t("admin.systemSettings"),
    description: kind === "capabilities" ? t("admin.capabilitiesDescription") : t("admin.systemSettingsDescription"),
    permissions: {
      read: ["system.config.read"],
      update: ["system.config"],
    },
    list: {
      realtimeDependencies: ["capabilities", "settings"],
      load: async () => {
        const result = kind === "capabilities" ? await AppCache.admin.listCapabilities() : await AppCache.admin.listSettings();
        if (!result.success || !result.data) throw new Error(result.error?.message ?? t("admin.loading"));
        return result.data as SystemRow[];
      },
      columns: kind === "capabilities"
        ? [
            { key: "name", label: t("admin.name"), render: (row) => (row as RuntimeCapabilityDto).name },
            { key: "key", label: t("admin.key"), render: (row) => (row as RuntimeCapabilityDto).capabilityKey },
            { key: "status", label: t("admin.status"), render: (row) => (row as RuntimeCapabilityDto).currentStatus },
          ]
        : [
            { key: "name", label: t("admin.name"), render: (row) => (row as SystemSettingDto).displayName },
            { key: "key", label: t("admin.key"), render: (row) => (row as SystemSettingDto).settingKey },
            { key: "value", label: t("admin.value"), render: (row) => (row as SystemSettingDto).isSecret ? "••••••" : (row as SystemSettingDto).valueText ?? "—" },
          ],
      emptyLabel: t("admin.noRecords"),
      loadingLabel: t("admin.loading"),
    },
  }), [kind, t]);
  const collection = useAdminResourceController(resource, undefined);
  const canUpdate = canUseAdminResourceOperation(resource, "update", authorization.permissions);
  const surface = useAdminWorkspaceStore((state) => state.surface);
  const editing = surface?.moduleKey === resource.moduleKey && surface.resourceId
    ? collection.rows.find((row) => row.id === surface.resourceId) ?? null
    : null;
  const setting = editing && kind === "settings" ? editing as SystemSettingDto : undefined;
  const definition = useMemo(() => systemForm(t, kind, setting), [kind, setting, t]);
  const formSurface = useAdminFormSurface<SystemForm>({
    moduleKey: resource.moduleKey,
    surfaceKey: "edit",
    surfaceKind: "modal",
    draftKey: `admin.system.${kind}.edit`,
    formVersion: definition.version,
    initialValues: {},
    closePolicy: "discard",
    confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"),
    confirmDescription: t("admin.discardDescription"),
    confirmConfirmLabel: t("admin.discardChanges"),
    confirmCancelLabel: t("admin.keepEditing"),
  });
  const openEdit = (row: SystemRow) => {
    formSurface.complete();
    formSurface.initialize(kind === "capabilities"
      ? { status: (row as RuntimeCapabilityDto).currentStatus }
      : { valueText: (row as SystemSettingDto).valueText ?? "" });
    formSurface.open({ mode: "edit", resourceId: row.id });
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const succeeded = await collection.controller.executeAction(
      {
        key: "update",
        label: t("admin.saveChanges"),
        execute: async () => {
          const result = kind === "capabilities"
            ? await AppCache.admin.updateCapabilityStatus({ capabilityKey: (editing as RuntimeCapabilityDto).capabilityKey, status: formSurface.values.status as "enabled" | "disabled" | "optional" })
            : await AppCache.admin.updateSetting({ settingKey: (editing as SystemSettingDto).settingKey, settingValueText: String(formSurface.values.valueText ?? ""), expectedRowVersion: (editing as SystemSettingDto).rowVersion });
          if (!result.success) throw new Error(result.error?.message ?? t("admin.loading"));
        },
      },
      editing,
    );
    if (succeeded) formSurface.complete();
  };
  const definitionForScreen: AdminCollectionDefinition<SystemRow> = {
    title: resource.label,
    description: resource.description,
    icon: "settings",
    columns: resource.list.columns,
    loadingLabel: resource.list.loadingLabel,
    emptyLabel: resource.list.emptyLabel,
    rows: collection.rows,
    loading: collection.loading,
    error: collection.error,
    onOpen: canUpdate ? openEdit : undefined,
    rowLabel: (row) => kind === "capabilities"
      ? (row as RuntimeCapabilityDto).name
      : (row as SystemSettingDto).displayName,
    actionMenuLabel: t("admin.actions"),
    refreshLabel: t("admin.refresh"),
    onRefresh: () => void collection.refresh(),
    actions: [{ key: "edit", label: t("admin.edit"), tone: "primary", onClick: (row) => openEdit(row), hidden: () => !canUpdate }],
    pagination: { stateKey: resource.moduleKey },
  };
  return (
    <>
      <AdminCollectionScreen definition={definitionForScreen} />
      {formSurface.isOpen && editing && <AdminFormDialog title={t("admin.edit")} definition={definition} values={formSurface.values} pending={collection.pending} submitLabel={t("admin.saveChanges")} cancelLabel={t("admin.cancel")} onChange={(name, value) => formSurface.setValues((current) => ({ ...current, [name]: value }))} onSubmit={(event) => void submit(event)} onClose={() => void formSurface.close()} />}
    </>
  );
}
