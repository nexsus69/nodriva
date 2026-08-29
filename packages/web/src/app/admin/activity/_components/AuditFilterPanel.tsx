"use client";

/** Presents semantic audit filters while the controller owns their query lifecycle. */
import type { AuditFilterCatalogDto, UserListItemDto } from "@dashboard/core";
import { FormRenderer } from "@/app/components/ui/forms";
import { auditFilterBuilder } from "./AuditFilterBuilder";
import type { AuditFilterForm } from "./auditFilterModel";

type Translate = (key: string, fallback?: string) => string;

export function AuditFilterPanel({ t, users, catalog, values, onChange, onApply, onClear }: {
  t: Translate;
  users: readonly UserListItemDto[];
  catalog: AuditFilterCatalogDto | null;
  values: AuditFilterForm;
  onChange: (next: AuditFilterForm) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return <section className="border border-slate-200 bg-white p-6"><FormRenderer definition={auditFilterBuilder.build({ t, users, catalog, values })} values={values} onChange={(name, value) => onChange({ ...values, [name]: value })} onSubmit={(event) => { event.preventDefault(); onApply(); }} submitLabel={t("admin.applyFilters")} cancelLabel={t("admin.clearFilters")} onCancel={onClear} theme="light" /></section>;
}
