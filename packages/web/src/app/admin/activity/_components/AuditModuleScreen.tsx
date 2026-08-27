"use client";

/** Provides filtered audit exploration and a before/after detail view. */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  AuditLogDetailDto,
  AuditLogFilterDto,
  AuditLogListItemDto,
  AuditFilterCatalogDto,
  UserListItemDto,
} from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { Alert, Skeleton } from "@/app/components/ui/feedback";
import {
  createValidationMessages,
  defineForm,
  FormRenderer,
  type FormDefinition,
} from "@/app/components/ui/forms";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminPagination } from "@/adminPanel/components/AdminPagination";
import { AdminTable } from "@/adminPanel/components/AdminTable";
import { useAdminPagination } from "@/adminPanel/useAdminPagination";
import { useAdminModuleState } from "@/adminPanel/useAdminModuleState";
import { AdminPageHeader } from "@/adminPanel/components/AdminPageHeader";
import { AdminSurfaceHost } from "@/adminPanel/components/AdminSurfaceHost";
import { defineAdminSurface } from "@/adminPanel/AdminSurfaceDefinition";
import { AdminSurfaceHeader } from "@/adminPanel/components/AdminSurfaceHeader";
import { auditSemanticOption } from "./auditSemanticCatalog";

const AUDIT_DETAIL_SURFACE = defineAdminSurface({
  key: "audit-detail",
  moduleKey: "activity.audit",
  tabs: [],
  initialTab: "",
  presentation: "drawer",
  placement: "right",
  size: "xl",
  appearance: "light",
  initialState: {},
});

type AuditFilterForm = Record<string, unknown>;

/** Defines the reusable audit filter form. */
function auditFilterDefinition(
  t: (key: string) => string,
  users: readonly UserListItemDto[],
  catalog: AuditFilterCatalogDto | null,
  selected: AuditFilterForm,
): FormDefinition<AuditFilterForm> {
  const actionKeys = catalog?.actionKeys ?? [];
  const resourceKinds = catalog?.resourceKinds ?? [];
  const selectedAction = String(selected.actionKey ?? "");
  const selectedResourceKind = String(selected.resourceKind ?? "");
  const actionOptions = [...new Set([...actionKeys, ...(selectedAction ? [selectedAction] : [])])]
    .map((value) => auditSemanticOption(value, "action", t));
  const resourceOptions = [...new Set([...resourceKinds, ...(selectedResourceKind ? [selectedResourceKind] : [])])]
    .map((value) => auditSemanticOption(value, "resource", t));
  return defineForm({
    key: "admin.audit.filters",
    version: "1",
    validationMessages: createValidationMessages(t),
    fields: [
      {
        name: "actorUserId",
        type: "select",
        label: t("admin.user"),
        options: [
          { value: "", label: t("admin.allUsers") },
          ...users.map((user) => ({ value: user.id, label: user.email })),
        ],
      },
      { name: "actionKey", type: "select", label: t("admin.action"), options: actionOptions, searchable: true, disabled: !catalog, description: catalog ? undefined : t("admin.auditCatalogLoading") },
      { name: "resourceKind", type: "select", label: t("admin.resourceKind"), options: resourceOptions, searchable: true, disabled: !catalog, description: catalog ? undefined : t("admin.auditCatalogLoading") },
      { name: "fromDate", type: "date", label: t("admin.fromDate") },
      { name: "toDate", type: "date", label: t("admin.toDate") },
    ],
    layout: { columns: 3, gap: "normal" },
  });
}

/** Renders one audit record's immutable before/after payloads. */
function AuditDetail({
  detail,
  t,
  onClose,
}: {
  detail: AuditLogDetailDto;
  t: (key: string) => string;
  onClose: () => void;
}) {
  return (
    <AdminSurfaceHost
      definition={AUDIT_DETAIL_SURFACE}
      onClose={onClose}
      labelledBy="audit-detail-title"
    >
      <AdminSurfaceHeader
        title={t("admin.auditDetail")}
        titleId="audit-detail-title"
        subtitle={`${detail.resourceKind}:${detail.resourceId}`}
        closeLabel={t("admin.close")}
        onClose={onClose}
      />
      <div className="p-6">
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <div><dt className="text-slate-500">{t("admin.action")}</dt><dd>{auditSemanticOption(detail.actionKey, "action", t).label}<span className="ml-2 font-mono text-slate-500">{detail.actionKey}</span></dd></div>
          <div><dt className="text-slate-500">{t("admin.resourceKind")}</dt><dd>{auditSemanticOption(detail.resourceKind, "resource", t).label}: {detail.resourceId}</dd></div>
          <div><dt className="text-slate-500">{t("admin.actor")}</dt><dd>{detail.actorEmail ?? detail.actorUserId ?? "—"}</dd></div>
          <div><dt className="text-slate-500">{t("admin.createdAt")}</dt><dd>{detail.createdAt}</dd></div>
        </dl>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <pre className="overflow-auto border border-slate-200 bg-slate-50 p-4 text-[11px]">{JSON.stringify(detail.beforePayload, null, 2)}</pre>
          <pre className="overflow-auto border border-slate-200 bg-slate-50 p-4 text-[11px]">{JSON.stringify(detail.afterPayload, null, 2)}</pre>
        </div>
      </div>
    </AdminSurfaceHost>
  );
}

/** Provides the full audit query and detail workflow. */
export function AuditModuleScreen() {
  const { t } = useAppLocale();
  const [users, setUsers] = useState<readonly UserListItemDto[]>([]);
  const [catalog, setCatalog] = useState<AuditFilterCatalogDto | null>(null);
  const [rows, setRows] = useState<AuditLogListItemDto[]>([]);
  const [selected, setSelected] = useState<AuditLogDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const moduleDefaults = useMemo(
    () => ({ filters: {} as AuditFilterForm, selectedAuditId: "" }),
    [],
  );
  const [moduleState, updateModuleState] = useAdminModuleState(
    "activity.audit",
    moduleDefaults,
  );
  const filters = moduleState.filters;
  const pagination = useAdminPagination({ total, stateKey: "activity.audit" });
  const definition = useMemo(() => auditFilterDefinition(t, users, catalog, filters), [catalog, filters, t, users]);

  /** Loads one server-side page while preserving the current rows during refresh. */
  const load = async (next: AuditFilterForm = filters, requestedPage = pagination.page) => {
    setLoading(true);
    try {
      const query: AuditLogFilterDto = {
        actorUserId: String(next.actorUserId ?? "") || undefined,
        actionKey: String(next.actionKey ?? "") || undefined,
        resourceKind: String(next.resourceKind ?? "") || undefined,
        fromDate: String(next.fromDate ?? "") || undefined,
        toDate: String(next.toDate ?? "") || undefined,
        page: requestedPage,
        pageSize: pagination.pageSize,
      };
      const result = await AppCache.admin.listAuditLogs(query);
      if (!result.success || !result.data) throw new Error(result.error?.message ?? t("admin.loadingAudit"));
      setRows(result.data.items);
      setTotal(result.data.total);
      pagination.setPage(result.data.page);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void AppCache.users.listUsers().then(setUsers).catch(() => undefined);
    void AppCache.admin.listAuditFilterCatalog().then((result) => {
      if (result.success && result.data) setCatalog(result.data);
      else setError(new Error(result.error?.message ?? t("admin.auditCatalogUnavailable")));
    });
    void Promise.resolve().then(() => load(filters, pagination.page));
    // The initial audit load must run once; filters trigger explicit submits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!moduleState.selectedAuditId) return;
    void AppCache.admin.getAuditLogById(moduleState.selectedAuditId).then((result) => {
      if (result.success && result.data) setSelected(result.data);
    });
  }, [moduleState.selectedAuditId]);
  const visibleDetail = moduleState.selectedAuditId === selected?.id ? selected : null;

  /** Applies filters and starts again from the first result page. */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pagination.reset();
    void load(filters, 1);
  };

  /** Loads immutable detail data for the selected audit row. */
  const openDetail = async (row: AuditLogListItemDto) => {
    updateModuleState({ selectedAuditId: row.id });
  };

  const columns = useMemo(
    () => [
      { key: "action", label: t("admin.action"), render: (row: AuditLogListItemDto) => auditSemanticOption(row.actionKey, "action", t).label, sortValue: (row: AuditLogListItemDto) => row.actionKey },
      { key: "resource", label: t("admin.resourceKind"), render: (row: AuditLogListItemDto) => `${auditSemanticOption(row.resourceKind, "resource", t).label}: ${row.resourceId}` },
      { key: "actor", label: t("admin.actor"), render: (row: AuditLogListItemDto) => row.actorEmail ?? row.actorUserId ?? "—" },
      { key: "createdAt", label: t("admin.createdAt"), render: (row: AuditLogListItemDto) => row.createdAt },
    ],
    [t],
  );

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title={t("admin.auditLog")}
        description={t("admin.auditDescription")}
        icon="activity"
        breadcrumbs={[{ label: t("admin.activity") }]}
      />
      <section className="border border-slate-200 bg-white p-6">
        <FormRenderer
          definition={definition}
          values={filters}
          onChange={(name, value) => updateModuleState({ filters: { ...filters, [name]: value } })}
          onSubmit={submit}
          submitLabel={t("admin.applyFilters")}
          cancelLabel={t("admin.clearFilters")}
          onCancel={() => { updateModuleState({ filters: {} }); pagination.reset(); void load({}, 1); }}
          theme="light"
        />
      </section>
      {visibleDetail && <AuditDetail detail={visibleDetail} t={t} onClose={() => updateModuleState({ selectedAuditId: "" })} />}
      {error && <Alert tone="danger">{error.message}</Alert>}
      {loading && rows.length === 0 ? <Skeleton className="h-40 w-full" /> : (
        <div className="space-y-3">
          {loading && <p className="text-xs text-slate-400" aria-live="polite">{t("admin.loadingAudit")}…</p>}
          <AdminTable
            rows={rows}
            columns={columns}
            emptyLabel={t("admin.noRecords")}
            onOpen={(row) => void openDetail(row)}
            rowLabel={(row) => `${row.actionKey} · ${row.resourceKind}`}
            actionMenuLabel={t("admin.actions")}
          />
          {pagination.pageCount > 1 && <AdminPagination page={pagination.page} pageCount={pagination.pageCount} onPageChange={(nextPage) => void load(filters, nextPage)} />}
        </div>
      )}
    </section>
  );
}
