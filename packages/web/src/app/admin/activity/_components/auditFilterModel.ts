import type { AuditLogFilterDto } from "@dashboard/core";

/** Browser form values are deliberately separate from the typed remote query. */
export type AuditFilterForm = Record<string, unknown>;

/** Converts optional form controls to the server-side filter contract. */
export function toAuditFilterQuery(
  values: AuditFilterForm,
  page: number,
  pageSize: number,
): AuditLogFilterDto {
  return {
    actorUserId: String(values.actorUserId ?? "") || undefined,
    actionKey: String(values.actionKey ?? "") || undefined,
    resourceKind: String(values.resourceKind ?? "") || undefined,
    fromDate: String(values.fromDate ?? "") || undefined,
    toDate: String(values.toDate ?? "") || undefined,
    page,
    pageSize,
  };
}
