"use client";

/** Composes capability and system-setting collections with shared edit forms. */
import { useMemo, type FormEvent } from "react";
import type { RuntimeCapabilityDto, SystemSettingDto } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { createValidationMessages, defineForm, ToggleSwitch, type FormDefinition, type FormFieldSchema } from "@/app/components/ui/forms";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { AdminFormDialog } from "@/adminPanel/components/AdminFormDialog";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";
import { canUseAdminResourceOperation, defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import {
  runtimeCapabilitySemanticEntry,
  systemSettingSemanticEntry,
} from "@/adminPanel/adminSemanticCatalog";

type SystemRow = RuntimeCapabilityDto | SystemSettingDto;
type SystemForm = { status?: string; valueText?: string | boolean };
export type SystemSettingsSection = "field-protection" | "attachment-protection" | "audit-recording" | "session-security" | "backup" | "other-settings";

const SETTING_SECTION_ICONS: Record<SystemSettingsSection, "settings" | "shield"> = {
  "field-protection": "shield",
  "attachment-protection": "shield",
  "audit-recording": "settings",
  "session-security": "shield",
  backup: "settings",
  "other-settings": "settings",
};

const SETTING_SECTIONS: Record<SystemSettingsSection, { moduleKey: string; titleKey: string; descriptionKey: string; settingKeys?: readonly string[] }> = {
  "field-protection": { moduleKey: "model.field-protection", titleKey: "admin.fieldProtection", descriptionKey: "admin.fieldProtectionDescription", settingKeys: ["data.fieldsEncryptionEnabled"] },
  "attachment-protection": { moduleKey: "content.attachment-protection", titleKey: "admin.attachmentProtection", descriptionKey: "admin.attachmentProtectionDescription", settingKeys: ["attachments.antivirusEnabled", "attachments.encryptionEnabled"] },
  "audit-recording": { moduleKey: "governance.audit-recording", titleKey: "admin.auditRecording", descriptionKey: "admin.auditRecordingDescription", settingKeys: ["audit.recordLockLifecycle"] },
  "session-security": { moduleKey: "platform.session-security", titleKey: "admin.sessionSecurity", descriptionKey: "admin.sessionSecurityDescription", settingKeys: ["session.idleTimeoutSeconds"] },
  backup: { moduleKey: "platform.backup", titleKey: "admin.backup", descriptionKey: "admin.backupDescription", settingKeys: ["backup.scheduledEnabled"] },
  "other-settings": { moduleKey: "platform.other-settings", titleKey: "admin.otherSettings", descriptionKey: "admin.otherSettingsDescription" },
};

const CLASSIFIED_SETTING_KEYS = Object.values(SETTING_SECTIONS)
  .flatMap((section) => section.settingKeys ?? []);

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
  const semantic = setting ? systemSettingSemanticEntry(setting, t) : null;
  const common = {
    name: "valueText",
    label: semantic?.label ?? t("admin.value"),
    required: true,
    description: semantic?.description,
  };
  if (setting?.valueType === "json") return { ...common, type: "textarea", rows: 4 };
  if (setting?.valueType === "boolean") {
    return { ...common, type: "boolean" };
  }
  if (setting?.valueType === "integer" || setting?.valueType === "decimal") {
    return { ...common, type: "number" };
  }
  return { ...common, type: "text" };
}

/** Provides editable capability and setting collections through one screen contract. */
export function SystemConfigModuleScreen({ kind, section }: { kind: "capabilities" | "settings"; section?: SystemSettingsSection }) {
  const { t } = useAppLocale();
  const settingsSection = kind === "settings" && section ? SETTING_SECTIONS[section] : null;
  const moduleKey = kind === "capabilities" ? "platform.runtime" : settingsSection?.moduleKey ?? "platform.settings";
  const authorization = useAdminAuthorization();
  const resource = useMemo(() => defineAdminResource<SystemRow>({
    key: kind,
    moduleKey,
    label: kind === "capabilities" ? t("admin.runtime") : t(settingsSection?.titleKey ?? "admin.systemSettings"),
    description: kind === "capabilities" ? t("admin.runtimeDescription") : t(settingsSection?.descriptionKey ?? "admin.systemSettingsDescription"),
    permissions: {
      read: ["system.config.read"],
      update: ["system.config"],
    },
    list: {
      realtimeDependencies: ["capabilities", "settings"],
      load: async () => {
        const result = kind === "capabilities" ? await AppCache.admin.listCapabilities() : await AppCache.admin.listSettings();
        if (!result.success || !result.data) throw new Error(result.error?.message ?? t("admin.loading"));
        const rows = result.data as SystemRow[];
        return kind === "settings" && settingsSection
          ? rows.filter((row) => settingsSection.settingKeys
            ? settingsSection.settingKeys.includes((row as SystemSettingDto).settingKey)
            : !CLASSIFIED_SETTING_KEYS.includes((row as SystemSettingDto).settingKey))
          : rows;
      },
      columns: kind === "capabilities"
        ? [
            { key: "name", label: t("admin.name"), render: (row) => {
              const semantic = runtimeCapabilitySemanticEntry(row as RuntimeCapabilityDto, t);
              return <div><p className="font-medium text-slate-900">{semantic.label}</p><p className="mt-0.5 text-xs text-slate-500">{semantic.description}</p></div>;
            } },
            { key: "key", label: t("admin.key"), render: (row) => (row as RuntimeCapabilityDto).capabilityKey },
            { key: "status", label: t("admin.status"), render: (row) => t(`admin.${(row as RuntimeCapabilityDto).currentStatus}`) },
          ]
        : [
            { key: "name", label: t("admin.name"), render: (row) => {
              const semantic = systemSettingSemanticEntry(row as SystemSettingDto, t);
              return <div><p className="font-medium text-slate-900">{semantic.label}</p><p className="mt-0.5 text-xs text-slate-500">{semantic.description}</p></div>;
            } },
            { key: "key", label: t("admin.key"), render: (row) => (row as SystemSettingDto).settingKey },
            { key: "value", label: t("admin.value"), render: (row) => (row as SystemSettingDto).isSecret ? "••••••" : (row as SystemSettingDto).valueText ?? "—" },
          ],
      emptyLabel: t("admin.noRecords"),
      loadingLabel: t("admin.loading"),
    },
  }), [kind, moduleKey, settingsSection, t]);
  const collection = useAdminResourceController(resource, undefined);
  const canUpdate = canUseAdminResourceOperation(resource, "update", authorization.permissions);
  const surface = useAdminWorkspaceStore((state) => state.surface);
  const editing = surface?.moduleKey === resource.moduleKey && surface.resourceId
    ? collection.rows.find((row) => row.id === surface.resourceId) ?? null
    : null;
  const setting = editing && kind === "settings" ? editing as SystemSettingDto : undefined;
  const definition = useMemo(() => systemForm(t, kind, setting), [kind, setting, t]);
  const columns = useMemo(() => {
    if (kind === "capabilities") return resource.list.columns;
    return [
      resource.list.columns[0],
      resource.list.columns[1],
      {
        key: "value",
        label: t("admin.value"),
        render: (row: SystemRow) => {
          const current = row as SystemSettingDto;
          if (current.valueType !== "boolean") return current.isSecret ? "••••••" : current.valueText ?? "—";
          return (
            <ToggleSwitch
              checked={current.valueText === "true"}
              disabled={!canUpdate}
              label={systemSettingSemanticEntry(current, t).label}
              onLabel={t("admin.yes")}
              offLabel={t("admin.no")}
              className="w-[4.5rem]"
              onChange={(next) => {
                if (collection.pending) return;
                void collection.controller.executeAction(
                  {
                    key: "toggle-setting",
                    label: t("admin.saveChanges"),
                    execute: async () => {
                      const result = await AppCache.admin.updateSetting({
                        settingKey: current.settingKey,
                        settingValueText: String(next),
                        expectedRowVersion: current.rowVersion,
                      });
                      if (!result.success) throw new Error(result.error?.message ?? t("admin.loading"));
                    },
                  },
                  current,
                );
              }}
            />
          );
        },
      },
    ];
  }, [canUpdate, collection.controller, collection.pending, kind, resource.list.columns, t]);
  const formSurface = useAdminFormSurface<SystemForm>({
    moduleKey: resource.moduleKey,
    surfaceKey: "edit",
    surfaceKind: "modal",
    draftKey: `admin.${resource.moduleKey}.edit`,
    formVersion: definition.version,
    initialValues: {},
  });
  const openEdit = (row: SystemRow) => {
    formSurface.complete();
    formSurface.initialize(kind === "capabilities"
      ? { status: (row as RuntimeCapabilityDto).currentStatus }
      : { valueText: (row as SystemSettingDto).valueType === "boolean"
        ? (row as SystemSettingDto).valueText === "true"
        : (row as SystemSettingDto).valueText ?? "" });
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
    icon: kind === "capabilities" ? "settings" : settingsSection ? SETTING_SECTION_ICONS[section!] : "settings",
    columns,
    loadingLabel: resource.list.loadingLabel,
    emptyLabel: resource.list.emptyLabel,
    rows: collection.rows,
    loading: collection.loading,
    error: collection.error,
    onOpen: canUpdate ? openEdit : undefined,
    rowLabel: (row) => kind === "capabilities"
      ? runtimeCapabilitySemanticEntry(row as RuntimeCapabilityDto, t).label
      : systemSettingSemanticEntry(row as SystemSettingDto, t).label,
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
