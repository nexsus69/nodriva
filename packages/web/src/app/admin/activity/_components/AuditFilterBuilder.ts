import type { AuditFilterCatalogDto, UserListItemDto } from "@dashboard/core";
import { createValidationMessages, defineForm, type FormDefinition } from "@/app/components/ui/forms";
import type { AdminFilterBuilder } from "@/adminPanel/AdminFilterBuilder";
import { auditSemanticOption } from "./auditSemanticCatalog";
import type { AuditFilterForm } from "./auditFilterModel";

type Translate = (key: string, fallback?: string) => string;

export interface AuditFilterBuildContext {
  t: Translate;
  users: readonly UserListItemDto[];
  catalog: AuditFilterCatalogDto | null;
  values: AuditFilterForm;
}

/** Builds the semantic Audit Log filters from the catalog available to this user. */
export const auditFilterBuilder: AdminFilterBuilder<AuditFilterForm, AuditFilterBuildContext> = {
  build({ t, users, catalog, values }): FormDefinition<AuditFilterForm> {
    const actionKeys = catalog?.actionKeys ?? [];
    const resourceKinds = catalog?.resourceKinds ?? [];
    const selectedAction = String(values.actionKey ?? "");
    const selectedResourceKind = String(values.resourceKind ?? "");
    return defineForm({
      key: "admin.audit.filters",
      version: "1",
      validationMessages: createValidationMessages(t),
      fields: [
        { name: "actorUserId", type: "select", label: t("admin.user"), options: [{ value: "", label: t("admin.allUsers") }, ...users.map((user) => ({ value: user.id, label: user.email }))] },
        { name: "actionKey", type: "select", label: t("admin.action"), options: [...new Set([...actionKeys, ...(selectedAction ? [selectedAction] : [])])].map((value) => auditSemanticOption(value, "action", t)), searchable: true, disabled: !catalog, description: catalog ? undefined : t("admin.auditCatalogLoading") },
        { name: "resourceKind", type: "select", label: t("admin.resourceKind"), options: [...new Set([...resourceKinds, ...(selectedResourceKind ? [selectedResourceKind] : [])])].map((value) => auditSemanticOption(value, "resource", t)), searchable: true, disabled: !catalog, description: catalog ? undefined : t("admin.auditCatalogLoading") },
        { name: "fromDate", type: "date", label: t("admin.fromDate") },
        { name: "toDate", type: "date", label: t("admin.toDate") },
      ],
      layout: { columns: 3, gap: "normal" },
    });
  },
};
