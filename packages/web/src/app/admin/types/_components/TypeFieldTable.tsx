"use client";

/** Adapts type-field semantics to the reusable AdminTable surface. */
import type { FieldDto } from "@dashboard/core";
import { fieldDataTypeOption } from "@/adminPanel/adminSemanticCatalog";
import { AdminTable } from "@/adminPanel/components/AdminTable";

export function TypeFieldTable({
  fields,
  t,
  onAdd,
  onEdit,
  onDelete,
  onMove,
}: {
  fields: readonly FieldDto[];
  t: (key: string) => string;
  onAdd: () => void;
  onEdit: (field: FieldDto) => void;
  onDelete: (field: FieldDto) => void;
  onMove: (field: FieldDto, direction: -1 | 1) => void;
}) {
  const columns = [
    {
      key: "label",
      label: t("admin.label"),
      render: (field: FieldDto) => (
        <span className="font-semibold text-slate-800">{field.label}</span>
      ),
    },
    {
      key: "key",
      label: t("admin.fieldKey"),
      render: (field: FieldDto) => (
        <span className="font-mono text-slate-500">
          {field.fieldKey}
          <span className="block text-[10px]">{field.columnName}</span>
        </span>
      ),
    },
    {
      key: "type",
      label: t("admin.dataType"),
      render: (field: FieldDto) => (
        <span className="text-slate-600">{fieldDataTypeOption(field.dataType, t).label}</span>
      ),
    },
    {
      key: "status",
      label: t("admin.status"),
      render: (field: FieldDto) => (
        <span className="text-slate-500">
          {[
            field.isRequired && t("admin.requiredField"),
            field.isUnique && t("admin.uniqueField"),
            field.isIndexed && t("admin.indexedField"),
            field.encryptionMode === "encrypted" && `🔒 ${t("admin.encrypted")}`,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      ),
    },
  ];
  const actions = [
    { key: "up", label: "↑", onClick: (field: FieldDto) => onMove(field, -1) },
    { key: "down", label: "↓", onClick: (field: FieldDto) => onMove(field, 1) },
    {
      key: "edit",
      label: t("admin.edit"),
      tone: "primary" as const,
      onClick: onEdit,
    },
    {
      key: "delete",
      label: t("admin.delete"),
      tone: "danger" as const,
      hidden: (field: FieldDto) => field.isSystem,
      onClick: onDelete,
    },
  ];
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h3 className="font-semibold text-slate-900">{t("admin.fields")}</h3>
          <p className="mt-1 text-xs text-slate-500">{t("admin.fieldsDescription")}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          + {t("admin.addField")}
        </button>
      </div>
      <AdminTable
        rows={fields}
        columns={columns}
        actions={actions}
        onOpen={onEdit}
        emptyLabel={t("admin.noFields")}
        actionMenuLabel={t("admin.actions")}
      />
    </section>
  );
}
