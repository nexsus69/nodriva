"use client";

/** Provides a guided, safe composer for publishing immutable workflow definitions. */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { EventTypeDefinition, WorkflowCondition, WorkflowDefinition } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { createValidationMessages, defineForm, type FormDefinition } from "@/app/components/ui/forms";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { AdminFormDialog } from "@/adminPanel/components/AdminFormDialog";
import { defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";

type WorkflowRow = WorkflowDefinition & { id: string };
type WorkflowForm = {
  workflowId?: string; version?: number; eventType?: string; active?: boolean;
  conditionPath?: string; conditionOperator?: WorkflowCondition["operator"]; conditionValue?: string;
};

function workflowForm(t: (key: string) => string, eventTypes: readonly EventTypeDefinition[]): FormDefinition<WorkflowForm> {
  return defineForm({
    key: "admin.system.workflows.publish", version: "1", validationMessages: createValidationMessages(t),
    layout: { columns: 2, gap: "normal" },
    fields: [
      { name: "workflowId", type: "text", label: t("admin.workflowId"), description: t("admin.workflowIdHelp"), required: true, layout: { colSpan: 2 } },
      { name: "version", type: "number", label: t("admin.workflowVersion"), required: true, min: 1, step: 1 },
      { name: "active", type: "boolean", label: t("admin.workflowActive") },
      { name: "eventType", type: "select", label: t("admin.workflowTrigger"), required: true, options: eventTypes.filter((event) => event.isActive).map((event) => ({ value: event.eventType, label: `${event.eventType} · ${event.subjectKinds.join(", ")}` })), layout: { colSpan: 2 } },
      { name: "conditionPath", type: "text", label: t("admin.workflowCondition"), description: t("admin.workflowConditionHelp"), layout: { colSpan: 2 } },
      { name: "conditionOperator", type: "select", label: t("admin.workflowOperator"), options: ["equals", "not_equals", "exists", "in"].map((value) => ({ value, label: value })) },
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
    key: "workflows", moduleKey: "system.workflows", label: t("admin.workflows"), description: t("admin.workflowsDescription"),
    permissions: { read: ["system.config.read"], create: ["system.config"] },
    list: {
      load: async () => {
        const result = await AppCache.admin.listWorkflowDefinitions();
        if (!result.success || !result.data) throw new Error(result.error?.message ?? t("admin.loading"));
        return result.data.map((definition) => ({ ...definition, id: `${definition.workflowId}@${definition.version}` }));
      },
      columns: [
        { key: "workflow", label: t("admin.workflow"), render: (row) => row.workflowId },
        { key: "version", label: t("admin.workflowVersion"), render: (row) => `v${row.version}` },
        { key: "trigger", label: t("admin.workflowTrigger"), render: (row) => row.triggerEventTypes.join(", ") },
        { key: "action", label: t("admin.workflowAction"), render: (row) => row.steps.map((step) => step.actionType).join(", ") },
        { key: "status", label: t("admin.status"), render: (row) => row.isActive ? t("admin.enabled") : t("admin.disabled") },
      ], emptyLabel: t("admin.noWorkflows"), loadingLabel: t("admin.loading"),
    },
  }), [t]);
  const collection = useAdminResourceController(resource, undefined);
  const [eventTypes, setEventTypes] = useState<EventTypeDefinition[]>([]);
  const [eventError, setEventError] = useState<string | null>(null);
  useEffect(() => {
    void AppCache.admin.listWorkflowEventTypes().then((result) => {
      if (result.success && result.data) setEventTypes(result.data);
      else setEventError(result.error?.message ?? t("admin.loading"));
    });
  }, [t]);
  const definition = useMemo(() => workflowForm(t, eventTypes), [eventTypes, t]);
  const surface = useAdminFormSurface<WorkflowForm>({
    moduleKey: resource.moduleKey, surfaceKey: "publish", surfaceKind: "modal", draftKey: "admin.workflows.publish", formVersion: definition.version,
    initialValues: { version: 1, active: true, conditionOperator: "equals" }, closePolicy: "discard", confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"), confirmDescription: t("admin.discardDescription"), confirmConfirmLabel: t("admin.discardChanges"), confirmCancelLabel: t("admin.keepEditing"),
  });
  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const eventType = eventTypes.find((item) => item.eventType === surface.values.eventType);
    if (!eventType) { setEventError(t("admin.workflowSelectTrigger")); return; }
    const value = surface.values;
    const workflow: WorkflowDefinition = {
      workflowId: String(value.workflowId ?? "").trim(), version: Number(value.version), isActive: value.active !== false,
      triggerEventTypes: [eventType.eventType], conditions: parseCondition(value),
      steps: [{ stepId: "audit", actionType: "audit.record", input: {} }],
    };
    const succeeded = await collection.controller.executeAction({ key: "publish", label: t("admin.publishWorkflow"), execute: async () => {
      const result = await AppCache.admin.publishWorkflowDefinition(workflow);
      if (!result.success) throw new Error(result.error?.message ?? t("admin.loading"));
    } }, { ...workflow, id: `${workflow.workflowId}@${workflow.version}` });
    if (succeeded) { surface.complete(); await collection.reload(); }
  };
  const screen: AdminCollectionDefinition<WorkflowRow> = {
    title: resource.label, description: resource.description, icon: "activity", columns: resource.list.columns, rows: collection.rows,
    loading: collection.loading, error: collection.error ?? (eventError ? new Error(eventError) : null), emptyLabel: resource.list.emptyLabel,
    loadingLabel: resource.list.loadingLabel, createLabel: t("admin.createWorkflow"), onCreate: canPublish ? () => surface.open({ mode: "create" }) : undefined,
    refreshLabel: t("admin.refresh"), onRefresh: () => void collection.reload(), actionMenuLabel: t("admin.actions"), pagination: { stateKey: resource.moduleKey },
  };
  return <>{<AdminCollectionScreen definition={screen} />}{surface.isOpen && <AdminFormDialog title={t("admin.createWorkflow")} definition={definition} values={surface.values} pending={collection.pending} submitLabel={t("admin.publishWorkflow")} cancelLabel={t("admin.cancel")} onChange={(name, value) => surface.setValues((current) => ({ ...current, [name]: value }))} onSubmit={(event) => void publish(event)} onClose={() => void surface.close()}><p className="rounded border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">{t("admin.workflowAuditActionHelp")}</p></AdminFormDialog>}</>;
}
