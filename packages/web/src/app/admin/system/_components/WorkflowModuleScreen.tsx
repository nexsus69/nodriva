"use client";

/** Provides a guided, safe composer for publishing immutable workflow definitions. */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { EventTypeDefinition, WorkflowCondition, WorkflowDefinition } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { createValidationMessages, defineForm, type FormDefinition } from "@/app/components/ui/forms";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { AdminFormDialog } from "@/adminPanel/components/AdminFormDialog";
import { defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { useAdminRemotePagination } from "@/adminPanel/useAdminRemotePagination";
import { useAdminRealtimeCollectionRefresh } from "@/adminPanel/useAdminRealtimeCollectionRefresh";
import type { AdminTableSortState } from "@/adminPanel/components/AdminTable";

type WorkflowRow = WorkflowDefinition & { id: string };
type WorkflowForm = {
  name?: string; description?: string; customKey?: boolean; workflowId?: string; version?: number; eventType?: string; actionType?: string; active?: boolean;
  conditionPath?: string; conditionOperator?: WorkflowCondition["operator"]; conditionValue?: string;
};

/** Keeps workflow query state separate from the form and delegates windows to AppCache. */
function useWorkflowsRemoteCoordinator() {
  const moduleKey = "automation.workflows";
  const moduleState = useAdminWorkspaceStore((state) => state.moduleState[moduleKey]);
  const setModuleState = useAdminWorkspaceStore((state) => state.setModuleState);
  const [rows, setRows] = useState<readonly WorkflowRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [sort, setSortState] = useState<AdminTableSortState | null>(null);
  const version = useRef(0);
  const search = typeof moduleState?.search === "string" ? moduleState.search : "";
  const pagination = useAdminRemotePagination({ total, stateKey: moduleKey });
  const { page: currentPage, pageSize, setPage, reset } = pagination;
  const load = useCallback(async (requestedPage = currentPage) => {
    const request = ++version.current; setLoading(true); setError(null);
    const acceptedSort = sort && ["workflowId", "name", "version", "status"].includes(sort.columnKey)
      ? { key: sort.columnKey as "workflowId" | "name" | "version" | "status", direction: sort.direction } : undefined;
    try {
      const response = await AppCache.adminWorkflows.read({ page: requestedPage, pageSize, search: search.trim() || undefined, sort: acceptedSort });
      if (request !== version.current) return;
      setRows(response.items.map((item) => ({ ...item, id: `${item.workflowId}@${item.version}` }))); setTotal(response.total); setPage(response.page);
    } catch (reason) { if (request === version.current) setError(reason instanceof Error ? reason : new Error(String(reason))); }
    finally { if (request === version.current) setLoading(false); }
  }, [currentPage, pageSize, search, setPage, sort]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useAdminRealtimeCollectionRefresh(["workflow-definitions"], () => load(currentPage));
  const setSearch = useCallback((next: string) => { reset(); setModuleState(moduleKey, { search: next }); }, [reset, setModuleState]);
  const setSort = useCallback((next: AdminTableSortState) => { reset(); setSortState(next); }, [reset]);
  const execute = useCallback(async (work: () => Promise<void>) => { setPending(true); setError(null); try { await work(); await load(); return true; } catch (reason) { setError(reason instanceof Error ? reason : new Error(String(reason))); return false; } finally { setPending(false); } }, [load]);
  return { rows, loading, pending, error, search, setSearch, sort, setSort, pagination, load, execute };
}

/** Creates a safe snake_case proposal without changing an explicitly customized key. */
function workflowKeyFromName(value: unknown): string {
  const normalized = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!normalized) return "workflow";
  return (normalized.match(/^[a-z]/) ? normalized : `workflow_${normalized}`).slice(0, 100);
}

function workflowCatalogOption(value: string, category: "event" | "action", t: (key: string, fallback?: string) => string, description: string) {
  return { value, label: t(`admin.workflow${category === "event" ? "Event" : "ActionType"}.${value}`, value), description, keywords: [value] };
}

function workflowForm(
  t: (key: string, fallback?: string) => string,
  eventTypes: readonly EventTypeDefinition[],
  actionTypes: readonly string[],
  customKey: boolean,
): FormDefinition<WorkflowForm> {
  return defineForm({
    key: "admin.automation.workflows.publish", version: "2", validationMessages: createValidationMessages(t),
    layout: { columns: 2, gap: "normal" },
    fields: [
      { name: "name", type: "text", label: t("admin.workflowName"), description: t("admin.workflowNameHelp"), required: true, layout: { colSpan: 2 } },
      { name: "description", type: "textarea", label: t("admin.description"), rows: 2, layout: { colSpan: 2 } },
      { name: "customKey", type: "boolean", label: t("admin.workflowCustomizeKey"), description: t("admin.workflowCustomizeKeyHelp"), layout: { colSpan: 2 } },
      { name: "workflowId", type: "text", label: t("admin.workflowId"), description: customKey ? t("admin.workflowIdHelp") : t("admin.workflowGeneratedKeyHelp"), required: true, disabled: !customKey, validation: { pattern: "^[a-z][a-z0-9_]{0,99}$" }, layout: { colSpan: 2 } },
      { name: "version", type: "number", label: t("admin.workflowVersion"), required: true, min: 1, step: 1 },
      { name: "active", type: "boolean", label: t("admin.workflowActive") },
      { name: "eventType", type: "select", label: t("admin.workflowTrigger"), required: true, searchable: true, options: eventTypes.filter((event) => event.isActive).map((event) => workflowCatalogOption(event.eventType, "event", t, `${t("admin.workflowTechnicalValue")}: ${event.eventType} · ${event.subjectKinds.join(", ")}`)), layout: { colSpan: 2 } },
      { name: "actionType", type: "select", label: t("admin.workflowAction"), required: true, searchable: true, options: actionTypes.map((actionType) => workflowCatalogOption(actionType, "action", t, `${t("admin.workflowTechnicalValue")}: ${actionType}`)), layout: { colSpan: 2 } },
      { name: "conditionPath", type: "text", label: t("admin.workflowCondition"), description: t("admin.workflowConditionHelp"), layout: { colSpan: 2 } },
      { name: "conditionOperator", type: "select", label: t("admin.workflowOperator"), options: ["equals", "not_equals", "exists", "in"].map((value) => ({ value, label: t(`admin.workflowOperator.${value}`) })) },
      { name: "conditionValue", type: "text", label: t("admin.workflowValue"), description: t("admin.workflowValueHelp") },
    ],
  });
}

function parseCondition(values: WorkflowForm): WorkflowCondition[] {
  const path = values.conditionPath?.trim();
  if (!path) return [];
  const operator = values.conditionOperator ?? "equals";
  const rawValue = values.conditionValue?.trim();
  if (operator === "exists") return [{ path, operator }];
  let value: unknown = rawValue ?? "";
  if (rawValue) {
    try { value = JSON.parse(rawValue); } catch { value = rawValue; }
  }
  return [{ path, operator, value }];
}

/** Renders workflow definitions and a constrained first-action composer. */
export function WorkflowModuleScreen() {
  const { t } = useAppLocale();
  const authorization = useAdminAuthorization();
  const canPublish = authorization.permissions.has("system.config");
  const resource = useMemo(() => defineAdminResource<WorkflowRow>({
    key: "workflows", moduleKey: "automation.workflows", label: t("admin.workflows"), description: t("admin.workflowsDescription"),
    permissions: { read: ["system.config.read"], create: ["system.config"] },
    list: {
      realtimeDependencies: ["workflow-definitions"],
      mode: "remote",
      columns: [
        { key: "workflow", label: t("admin.workflow"), render: (row) => row.name ?? row.workflowId, sortValue: (row) => row.name ?? row.workflowId },
        { key: "version", label: t("admin.workflowVersion"), render: (row) => `v${row.version}` },
        { key: "trigger", label: t("admin.workflowTrigger"), render: (row) => row.triggerEventTypes.map((eventType) => workflowCatalogOption(eventType, "event", t, "").label).join(", ") },
        { key: "action", label: t("admin.workflowAction"), render: (row) => row.steps.map((step) => workflowCatalogOption(step.actionType, "action", t, "").label).join(", ") },
        { key: "status", label: t("admin.status"), render: (row) => row.isActive ? t("admin.enabled") : t("admin.disabled") },
      ], emptyLabel: t("admin.noWorkflows"), loadingLabel: t("admin.loading"),
    },
  }), [t]);
  const collection = useWorkflowsRemoteCoordinator();
  const [eventTypes, setEventTypes] = useState<EventTypeDefinition[]>([]);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [eventError, setEventError] = useState<string | null>(null);
  useEffect(() => {
    void Promise.all([AppCache.admin.listWorkflowEventTypes(), AppCache.admin.listWorkflowActionTypes()]).then(([eventResult, actionResult]) => {
      if (eventResult.success && eventResult.data) setEventTypes(eventResult.data);
      else setEventError(eventResult.error?.message ?? t("admin.loading"));
      if (actionResult.success && actionResult.data) setActionTypes(actionResult.data);
      else setEventError(actionResult.error?.message ?? t("admin.loading"));
    });
  }, [t]);
  const surface = useAdminFormSurface<WorkflowForm>({
    moduleKey: resource.moduleKey, surfaceKey: "publish", surfaceKind: "modal", draftKey: "admin.automation.workflows.publish", formVersion: "2",
    initialValues: { version: 1, active: true, actionType: "audit.record", conditionOperator: "equals" }, closePolicy: "discard", confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"), confirmDescription: t("admin.discardDescription"), confirmConfirmLabel: t("admin.discardChanges"), confirmCancelLabel: t("admin.keepEditing"),
  });
  const definition = useMemo(() => workflowForm(t, eventTypes, actionTypes, Boolean(surface.values.customKey)), [actionTypes, eventTypes, surface.values.customKey, t]);
  const workflowId = String(surface.values.workflowId ?? "").trim();
  const { isOpen: isWorkflowFormOpen, setValues: setWorkflowValues } = surface;
  useEffect(() => {
    if (!isWorkflowFormOpen || !/^[a-z][a-z0-9_]{0,99}$/.test(workflowId)) return;
    let active = true;
    void AppCache.admin.nextWorkflowDefinitionVersion(workflowId).then((result) => {
      if (active && result.success && result.data !== undefined) setWorkflowValues((current) => current.workflowId === workflowId ? { ...current, version: result.data } : current);
    });
    return () => { active = false; };
  }, [isWorkflowFormOpen, setWorkflowValues, workflowId]);
  const updateFormValue = (name: string, value: unknown) => surface.setValues((current) => {
    const next = { ...current, [name]: value };
    if (name === "name" && !current.customKey) {
      const workflowId = workflowKeyFromName(value);
      next.workflowId = workflowId;
    }
    if (name === "customKey" && !value) next.workflowId = workflowKeyFromName(current.name);
    return next;
  });
  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const eventType = eventTypes.find((item) => item.eventType === surface.values.eventType);
    if (!eventType) { setEventError(t("admin.workflowSelectTrigger")); return; }
    const value = surface.values;
    const workflow: WorkflowDefinition = {
      workflowId: String(value.workflowId ?? "").trim(), name: String(value.name ?? "").trim(), description: String(value.description ?? "").trim() || undefined,
      version: Number(value.version), isActive: value.active !== false,
      triggerEventTypes: [eventType.eventType], conditions: parseCondition(value),
      steps: [{ stepId: String(value.actionType ?? "audit.record").replace(/\./g, "_"), actionType: String(value.actionType ?? "audit.record"), input: {} }],
    };
    const succeeded = await collection.execute(async () => {
      const result = await AppCache.admin.publishWorkflowDefinition(workflow);
      if (!result.success) throw new Error(result.error?.message ?? t("admin.loading"));
    });
    if (succeeded) surface.complete();
  };
  const screen: AdminCollectionDefinition<WorkflowRow> = {
    title: resource.label, description: resource.description, icon: "activity", columns: resource.list.columns, rows: collection.rows,
    loading: collection.loading, error: collection.error ?? (eventError ? new Error(eventError) : null), emptyLabel: resource.list.emptyLabel,
    loadingLabel: resource.list.loadingLabel, createLabel: t("admin.createWorkflow"), onCreate: canPublish ? () => surface.open({ mode: "create" }) : undefined,
    refreshLabel: t("admin.refresh"), onRefresh: () => void collection.load(collection.pagination.page), actionMenuLabel: t("admin.actions"),
    search: { value: collection.search, label: "Cerca workflow", placeholder: "Cerca workflow", onChange: collection.setSearch },
    pagination: { mode: "remote", page: collection.pagination.page, pageCount: collection.pagination.pageCount, onPageChange: (page) => void collection.load(page), sort: collection.sort, onSortChange: collection.setSort },
  };
  return <>{<AdminCollectionScreen definition={screen} />}{surface.isOpen && <AdminFormDialog title={t("admin.createWorkflow")} definition={definition} values={surface.values} pending={collection.pending} submitLabel={t("admin.publishWorkflow")} cancelLabel={t("admin.cancel")} onChange={updateFormValue} onSubmit={(event) => void publish(event)} onClose={() => void surface.close()}><p className="rounded border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">{t("admin.workflowAuditActionHelp")}</p></AdminFormDialog>}</>;
}
