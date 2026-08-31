"use client";

/** Provides the shared modal surface for creating and editing one type field. */
import type { FormEvent } from "react";
import { AdminFormDialog } from "@/adminPanel/components/AdminFormDialog";
import { buildFieldDefinition, type FieldForm } from "./typeDetailModel";

export function TypeFieldDialog({
  field,
  editing,
  pending,
  t,
  onChange,
  onSubmit,
  onClose,
}: {
  field: FieldForm;
  editing: boolean;
  pending: boolean;
  t: (key: string) => string;
  onChange: (name: string, value: unknown) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <AdminFormDialog
      title={editing ? t("admin.editField") : t("admin.addField")}
      definition={buildFieldDefinition(t, {
        relationConfigurationDisabled: editing,
        dataType: field.dataType,
      })}
      values={field}
      pending={pending}
      submitLabel={editing ? t("admin.saveChanges") : t("admin.addField")}
      cancelLabel={t("admin.cancel")}
      onChange={onChange}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}
