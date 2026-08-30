"use client";

/** Renders immutable before/after evidence for one selected audit record. */
import type { AuditLogDetailDto } from "@dashboard/core";
import { AdminSurfaceHost } from "@/adminPanel/components/AdminSurfaceHost";
import { AdminSurfaceHeader } from "@/adminPanel/components/AdminSurfaceHeader";
import { defineAdminSurface } from "@/adminPanel/AdminSurfaceDefinition";
import { auditSemanticOption } from "./auditSemanticCatalog";

const SURFACE = defineAdminSurface({ key: "audit-detail", moduleKey: "governance.audit", tabs: [], initialTab: "", presentation: "drawer", placement: "right", size: "xl", appearance: "light", initialState: {} });
type Translate = (key: string, fallback?: string) => string;

export function AuditLogDetailDrawer({ detail, t, onClose }: { detail: AuditLogDetailDto; t: Translate; onClose: () => void }) {
  return <AdminSurfaceHost definition={SURFACE} onClose={onClose} labelledBy="audit-detail-title"><AdminSurfaceHeader title={t("admin.auditDetail")} titleId="audit-detail-title" subtitle={`${detail.resourceKind}:${detail.resourceId}`} closeLabel={t("admin.close")} onClose={onClose} /><div className="p-6"><dl className="grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">{t("admin.action")}</dt><dd>{auditSemanticOption(detail.actionKey, "action", t).label}<span className="ml-2 font-mono text-slate-500">{detail.actionKey}</span></dd></div><div><dt className="text-slate-500">{t("admin.resourceKind")}</dt><dd>{auditSemanticOption(detail.resourceKind, "resource", t).label}: {detail.resourceId}</dd></div><div><dt className="text-slate-500">{t("admin.actor")}</dt><dd>{detail.actorEmail ?? detail.actorUserId ?? "—"}</dd></div><div><dt className="text-slate-500">{t("admin.createdAt")}</dt><dd>{detail.createdAt}</dd></div></dl><div className="mt-6 grid gap-4 md:grid-cols-2"><pre className="overflow-auto border border-slate-200 bg-slate-50 p-4 text-[11px]">{JSON.stringify(detail.beforePayload, null, 2)}</pre><pre className="overflow-auto border border-slate-200 bg-slate-50 p-4 text-[11px]">{JSON.stringify(detail.afterPayload, null, 2)}</pre></div></div></AdminSurfaceHost>;
}
