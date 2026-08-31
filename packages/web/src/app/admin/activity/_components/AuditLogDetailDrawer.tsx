"use client";

/** Renders immutable before/after evidence for one selected audit record. */
import type { AuditLogDetailDto } from "@dashboard/core";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { formatAdminDateTime, formatAdminTechnicalIdentifier } from "@/adminPanel/adminFormatters";
import { AdminTechnicalIdentifier } from "@/adminPanel/components/AdminTechnicalIdentifier";
import { AdminSurfaceHost } from "@/adminPanel/components/AdminSurfaceHost";
import { AdminSurfaceHeader } from "@/adminPanel/components/AdminSurfaceHeader";
import { defineAdminSurface } from "@/adminPanel/AdminSurfaceDefinition";
import { ADMIN_THEME } from "@/Theme";
import { auditResourceLabel, auditSemanticOption } from "./auditSemanticCatalog";

const SURFACE = defineAdminSurface({ key: "audit-detail", moduleKey: "governance.audit", tabs: [], initialTab: "", presentation: "drawer", placement: "right", size: "xl", appearance: ADMIN_THEME.appearance, initialState: {} });
type Translate = (key: string, fallback?: string) => string;

export function AuditLogDetailDrawer({ detail, t, onClose }: { detail: AuditLogDetailDto; t: Translate; onClose: () => void }) {
  const { locale } = useAppLocale();
  const resourceLabel = auditResourceLabel(detail.resourceKind, detail.resourceLabel, t);
  const shortResourceId = formatAdminTechnicalIdentifier(detail.resourceId);
  return <AdminSurfaceHost definition={SURFACE} onClose={onClose} labelledBy="audit-detail-title"><AdminSurfaceHeader title={t("admin.auditDetail")} titleId="audit-detail-title" subtitle={`${resourceLabel}: ${shortResourceId}`} closeLabel={t("admin.close")} onClose={onClose} /><div className="p-6"><dl className="grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">{t("admin.action")}</dt><dd>{auditSemanticOption(detail.actionKey, "action", t).label}<span className="ml-2 text-slate-500">{detail.actionKey}</span></dd></div><div><dt className="text-slate-500">{t("admin.resourceKind")}</dt><dd>{resourceLabel}: <AdminTechnicalIdentifier value={detail.resourceId} copyable /></dd></div><div><dt className="text-slate-500">{t("admin.actor")}</dt><dd>{detail.actorEmail ?? detail.actorUserId ?? "—"}</dd></div><div><dt className="text-slate-500">{t("admin.createdAt")}</dt><dd>{formatAdminDateTime(detail.createdAt, locale)}</dd></div></dl><div className="mt-6 grid gap-4 md:grid-cols-2"><pre className="overflow-auto border border-slate-200 bg-slate-50 p-4 text-[11px]">{JSON.stringify(detail.beforePayload, null, 2)}</pre><pre className="overflow-auto border border-slate-200 bg-slate-50 p-4 text-[11px]">{JSON.stringify(detail.afterPayload, null, 2)}</pre></div></div></AdminSurfaceHost>;
}
