"use client";

/** Composes the reusable type workspace from independent tabs and surfaces. */
import { useMemo, type FormEvent } from "react";
import type { FieldDto, TypeKind } from "@dashboard/core";
import { Alert, Skeleton } from "@/app/components/ui/feedback";
import { FormRenderer } from "@/app/components/ui/forms";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { defineAdminSurface } from "@/adminPanel/AdminSurfaceDefinition";
import { AdminSurfaceHost } from "@/adminPanel/components/AdminSurfaceHost";
import { useAdminSurface } from "@/adminPanel/useAdminSurface";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { buildMetadataDefinition, EMPTY_FIELD, type FieldForm } from "./typeDetailModel";
import { useTypeDetailController } from "./useTypeDetailController";
import { TypeFieldDialog } from "./TypeFieldDialog";
import { TypeFieldTable } from "./TypeFieldTable";

export const TYPE_DETAIL_SURFACE = defineAdminSurface({
  key: "detail",
  moduleKey: "model.types",
  tabs: ["settings", "fields"],
  initialTab: "settings",
  presentation: "inline",
  placement: "right",
  appearance: "light",
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
  const { t } = useAppLocale();
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
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-indigo-600">
                {kind === "node"
                  ? t("admin.nodeTypes")
                  : t("admin.entityTypes")}
              </p>
              <h2
                id="type-detail-title"
                className="mt-1 text-xl font-semibold text-slate-900"
              >
                {controller.detail?.name ?? typeKey}
              </h2>
              <p className="mt-1 font-mono text-xs text-slate-500">{typeKey}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="text-2xl text-slate-400 hover:text-slate-800"
              aria-label={
                presentation === "inline"
                  ? t("admin.backToList")
                  : t("admin.cancel")
              }
            >
              {presentation === "inline" ? `← ${t("admin.backToList")}` : "×"}
            </button>
          </div>
          <nav className="mt-5 flex gap-5 text-sm font-semibold">
            {(["settings", "fields"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 pb-2 ${activeTab === tab ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-400"}`}
              >
                {tab === "settings"
                  ? t("admin.settings")
                  : `${t("admin.fields")} (${controller.detail?.fields.length ?? 0})`}
              </button>
            ))}
          </nav>
        </header>
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
              <FormRenderer
                definition={buildMetadataDefinition(t)}
                values={metadataForm.values}
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
