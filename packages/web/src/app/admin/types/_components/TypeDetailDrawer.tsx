"use client";

/** Composes the reusable type workspace from independent tabs and surfaces. */
import { useMemo, type FormEvent } from "react";
import type { FieldDto, TypeKind } from "@dashboard/core";
import { Alert, Skeleton } from "@/app/components/ui/feedback";
import { FormRenderer } from "@/app/components/ui/forms";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { defineAdminSurface } from "@/adminPanel/AdminSurfaceDefinition";
import { AdminSurfaceHost } from "@/adminPanel/components/AdminSurfaceHost";
import { AdminSurfaceHeader } from "@/adminPanel/components/AdminSurfaceHeader";
import { useAdminSurface } from "@/adminPanel/useAdminSurface";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { buildMetadataDefinition, EMPTY_FIELD, type FieldForm } from "./typeDetailModel";
import { useTypeDetailController } from "./useTypeDetailController";
import { TypeFieldDialog } from "./TypeFieldDialog";
import { TypeFieldTable } from "./TypeFieldTable";
import { ADMIN_THEME } from "@/Theme";
import { formatAdminDateTime } from "@/adminPanel/adminFormatters";

export const TYPE_DETAIL_SURFACE = defineAdminSurface({
  key: "detail",
  moduleKey: "model.types",
  tabs: ["settings", "fields"],
  initialTab: "settings",
  presentation: "inline",
  placement: "right",
  appearance: ADMIN_THEME.appearance,
  initialState: {
    activeTab: "settings" as "settings" | "fields",
    isDialogOpen: false,
    editingFieldId: null as string | null,
    draft: EMPTY_FIELD,
  },
});

export function TypeDetailDrawer({
  kind,
  typeKey,
  onClose,
  presentation = TYPE_DETAIL_SURFACE.presentation,
}: {
  kind: TypeKind;
  typeKey: string;
  onClose: () => void;
  presentation?: "drawer" | "inline" | "modal";
}) {
  const { locale, t } = useAppLocale();
  const controller = useTypeDetailController(kind, typeKey, t);
  const surface = useAdminSurface(TYPE_DETAIL_SURFACE);
  const activeTab = surface.activeTab;
  const metadataInitialValues = useMemo(
    () => ({
      name: controller.detail?.name ?? "",
      description: controller.detail?.description ?? "",
    }),
    [controller.detail?.description, controller.detail?.name],
  );
  const metadataForm = useAdminFormSurface<{ name: string; description: string }>({
    moduleKey: "model.types",
    surfaceKey: `type-metadata:${kind}:${typeKey}`,
    surfaceKind: "drawer",
    draftKey: `admin.types.metadata:${kind}:${typeKey}`,
    formVersion: "1",
    initialValues: metadataInitialValues,
    closePolicy: "discard",
    confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"),
    confirmDescription: t("admin.discardDescription"),
    confirmConfirmLabel: t("admin.discardChanges"),
    confirmCancelLabel: t("admin.keepEditing"),
  });
  const fieldForm = useAdminFormSurface<FieldForm>({
    moduleKey: "model.types",
    surfaceKey: `type-field:${kind}:${typeKey}`,
    surfaceKind: "modal",
    draftKey: `admin.types.field:${kind}:${typeKey}`,
    formVersion: "1",
    initialValues: EMPTY_FIELD,
    closePolicy: "discard",
    confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"),
    confirmDescription: t("admin.discardDescription"),
    confirmConfirmLabel: t("admin.discardChanges"),
    confirmCancelLabel: t("admin.keepEditing"),
  });
  const fieldDialogOpen = surface.isDialogOpen && fieldForm.isOpen;
  const editingFieldId = surface.editingFieldId;
  const field = fieldForm.values;
  const selectResource = useAdminWorkspaceStore(
    (state) => state.selectResource,
  );
  const setActiveTab = (tab: "settings" | "fields") => surface.setTab(tab);

  const close = async () => {
    if (!(await metadataForm.close())) return;
    if (!(await fieldForm.close())) return;
    selectResource(null);
    onClose();
  };
  const openAddField = () => {
    fieldForm.initialize(EMPTY_FIELD);
    fieldForm.open();
    surface.update({
      editingFieldId: null,
      draft: EMPTY_FIELD,
      isDialogOpen: true,
    });
  };
  const openEditField = (item: FieldDto) => {
    const nextField: FieldForm = {
      fieldKey: item.fieldKey,
      label: item.label,
      columnName: item.columnName,
      dataType: item.dataType,
      isRequired: item.isRequired,
      isUnique: item.isUnique,
      isIndexed: item.isIndexed,
      relationTargetDomain: (item.relationTargetDomain ?? "") as FieldForm["relationTargetDomain"],
      relationTargetTypeKey: item.relationTargetTypeKey ?? "",
      relationSourceCardinality: item.relationSourceCardinality ?? "one",
      relationTargetIsUnique: item.relationTargetIsUnique ?? false,
      relationInverseLabel: item.relationInverseLabel ?? "",
      enumMode: (item.enumMode ?? "") as FieldForm["enumMode"],
      encryptionMode: item.encryptionMode,
      defaultValueText: item.defaultValueText ?? "",
    };
    fieldForm.initialize(nextField);
    fieldForm.open();
    surface.update({
      editingFieldId: item.id,
      draft: nextField,
      isDialogOpen: true,
    });
  };
  const submitField = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await controller.saveField(field, editingFieldId)) {
      fieldForm.complete();
      surface.update({
        isDialogOpen: false,
        editingFieldId: null,
        draft: EMPTY_FIELD,
      });
    }
  };

  /** Closes the nested field form through the same confirmation lifecycle as every form. */
  const closeField = async () => {
    if (!(await fieldForm.close())) return;
    surface.update({
      isDialogOpen: false,
      editingFieldId: null,
      draft: EMPTY_FIELD,
    });
  };

  const surfaceDefinition = {
    ...TYPE_DETAIL_SURFACE,
    presentation,
  };

  return (
    <AdminSurfaceHost
      definition={surfaceDefinition}
      onClose={close}
      labelledBy="type-detail-title"
    >
        <AdminSurfaceHeader
          title={controller.detail?.name ?? typeKey}
          titleId="type-detail-title"
          eyebrow={kind === "node" ? t("admin.nodeTypes") : t("admin.entityTypes")}
          subtitle={typeKey}
          closeLabel={presentation === "inline" ? t("admin.backToList") : t("admin.cancel")}
          closeIcon={presentation === "inline" ? "arrow-left" : "close"}
          onClose={close}
          className={presentation === "inline" ? "-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8" : ""}
          tabs={[
            { key: "settings", label: t("admin.settings") },
            { key: "fields", label: `${t("admin.fields")} (${controller.detail?.fields.length ?? 0})` },
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as "settings" | "fields")}
        />
        <main className="space-y-6 p-6">
          {controller.loading && (
            <>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-32 w-full" />
            </>
          )}
          {controller.error && (
            <Alert tone="danger">{controller.error.message}</Alert>
          )}
          {controller.formError && (
            <Alert tone="danger">{controller.formError.message}</Alert>
          )}
          {!controller.loading &&
            controller.detail &&
            activeTab === "settings" && (
              <>
              <dl className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-slate-500">{t("admin.schemaVersion")}</dt><dd className="font-semibold text-slate-900">{controller.detail.currentSchemaVersion}</dd></div>
                <div><dt className="text-xs text-slate-500">{t("admin.recordRevision")}</dt><dd className="font-semibold text-slate-900">{controller.detail.rowVersion}</dd></div>
                <div><dt className="text-xs text-slate-500">{t("admin.status")}</dt><dd className="font-semibold text-slate-900">{controller.detail.isActive ? t("admin.active") : t("admin.disabled")}</dd></div>
                <div><dt className="text-xs text-slate-500">{t("admin.lastModified")}</dt><dd className="font-semibold text-slate-900">{formatAdminDateTime(controller.detail.updatedAt, locale)}</dd></div>
              </dl>
              <FormRenderer
                definition={buildMetadataDefinition(t)}
                values={metadataForm.values}
                theme={ADMIN_THEME.form}
                onChange={(name, value) =>
                  metadataForm.setValues((current) => ({
                    ...current,
                    [name]: String(value),
                  }))
                }
                onSubmit={(event) => {
                  void controller.saveMetadata(event, metadataForm.values).then((saved) => {
                    if (saved) metadataForm.complete();
                  });
                }}
                isPending={controller.pending}
                submitLabel={t("admin.saveChanges")}
                cancelLabel={t("admin.cancel")}
                onCancel={() => void close()}
              />
              </>
            )}
          {!controller.loading &&
            controller.detail &&
            activeTab === "fields" && (
                <TypeFieldTable
                  fields={controller.detail.fields}
                  t={t}
                  onAdd={openAddField}
                  onEdit={openEditField}
                onDelete={(item) => void controller.removeField(item)}
                onMove={(item, direction) =>
                  void controller.moveField(item.id, direction)
                }
              />
            )}
        </main>
      {fieldDialogOpen && (
        <TypeFieldDialog
          field={field}
          editing={Boolean(editingFieldId)}
          pending={controller.pending}
          t={t}
          onChange={(name, value) =>
            fieldForm.setValues((current) => ({ ...current, [name]: value }))
          }
          onSubmit={submitField}
          onClose={() => void closeField()}
        />
      )}
    </AdminSurfaceHost>
  );
}
