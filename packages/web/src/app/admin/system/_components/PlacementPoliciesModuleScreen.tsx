"use client";

/** Composes placement policy CRUD from shared resource, form, and surface contracts. */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PlacementPolicyDetailDto, PlacementPolicyListItemDto, RuleType } from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { requestConfirmation } from "@/app/components/ui/feedback/ConfirmDialogStore";
import { createValidationMessages, defineForm, type FormDefinition } from "@/app/components/ui/forms";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { loadVisibleScopeNodes, type ScopeNodeOption } from "@/app/admin/security/scopeNodeOptions";
import { canUseAdminResourceOperation, defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { defineAdminSurface } from "@/adminPanel/AdminSurfaceDefinition";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { AdminFormDialog } from "@/adminPanel/components/AdminFormDialog";
import { AdminSurfaceHost } from "@/adminPanel/components/AdminSurfaceHost";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAdminModuleState } from "@/adminPanel/useAdminModuleState";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { AdminButton } from "@/adminPanel/components/AdminButton";
import { AdminSurfaceHeader } from "@/adminPanel/components/AdminSurfaceHeader";
import { ADMIN_THEME } from "@/Theme";

type PolicyForm = { policyKey: string; name: string; description: string; policyMode: string };
type RuleForm = { ruleType: RuleType; targetNodeId: string; targetNodeTypeId: string; comparator: string; valueText: string };

const EMPTY_POLICY: PolicyForm = { policyKey: "", name: "", description: "", policyMode: "allow_all" };
const EMPTY_RULE: RuleForm = { ruleType: "allow_node_type", targetNodeId: "", targetNodeTypeId: "", comparator: "", valueText: "" };
const POLICY_MODES = ["allow_all", "deny_all", "node_type_whitelist", "node_subtree_whitelist", "custom_rule"] as const;
const RULE_TYPES: RuleType[] = ["allow_node_type", "deny_node_type", "allow_node", "deny_node", "allow_subtree", "deny_subtree"];

const POLICY_DETAIL_SURFACE = defineAdminSurface({
  key: "policy-detail",
  moduleKey: "model.placement-policies",
  tabs: [],
  initialTab: "",
  presentation: "drawer",
  placement: "right",
  appearance: ADMIN_THEME.appearance,
  initialState: {},
});

/** Builds the policy editor used for both create and update operations. */
function createPolicyForm(t: (key: string) => string, editing: boolean): FormDefinition<PolicyForm> {
  return defineForm({
    key: "admin.model.placement-policy.form",
    version: "2",
    validationMessages: createValidationMessages(t),
    fields: [
      { name: "policyKey", type: "text", label: t("admin.policyKey"), required: true, disabled: editing, validation: { rules: [{ kind: "pattern", value: "^[a-z0-9_]+$" }] }, layout: { row: "identity", colSpan: 1, order: 1 } },
      { name: "name", type: "text", label: t("admin.name"), required: true, validation: { minLength: 2 }, layout: { row: "identity", colSpan: 1, order: 2 } },
      { name: "description", type: "textarea", label: t("admin.description"), rows: 3, layout: { row: "description", colSpan: 2, order: 1 } },
      { name: "policyMode", type: "select", label: t("admin.policyMode"), required: true, options: POLICY_MODES.map((value) => ({ value, label: t(`admin.policyMode.${value}`) })), layout: { row: "mode", colSpan: 2, order: 1 } },
    ],
    sections: [
      { key: "identity", fieldNames: ["policyKey", "name"], columns: 2 },
      { key: "description", fieldNames: ["description"], columns: 2 },
      { key: "mode", fieldNames: ["policyMode"], columns: 2 },
    ],
    layout: { columns: 2, gap: "normal" },
  });
}

/** Builds the rule editor with the same hierarchical node selector used by scope forms. */
function createRuleForm(t: (key: string) => string, nodes: readonly ScopeNodeOption[], typeOptions: Array<{ value: string; label: string }>, nodesLoading: boolean): FormDefinition<RuleForm> {
  return defineForm({
    key: "admin.model.placement-policy.rule-form",
    version: "2",
    validationMessages: createValidationMessages(t),
    fields: [
      { name: "ruleType", type: "select", label: t("admin.ruleType"), required: true, options: RULE_TYPES.map((value) => ({ value, label: t(`admin.ruleType.${value}`) })) },
      { name: "targetNodeTypeId", type: "select", label: t("admin.targetNodeType"), options: [{ value: "", label: "—" }, ...typeOptions] },
      { name: "targetNodeId", type: "nodeTree", label: t("admin.targetNode"), nodes, loading: nodesLoading, interaction: "both", labels: { instruction: t("admin.scopeTreeInstruction"), empty: t("admin.scopeTreeEmpty"), loading: t("admin.scopeTreeLoading"), dropPlaceholder: t("admin.scopeTreeDropPlaceholder"), expand: t("admin.scopeTreeExpand"), collapse: t("admin.scopeTreeCollapse") } },
      { name: "comparator", type: "text", label: t("admin.comparator") },
      { name: "valueText", type: "text", label: t("admin.valueText") },
    ],
    layout: { columns: 2, gap: "normal" },
  });
}

/** Provides complete policy and rule management with reload-safe identities. */
export function PlacementPoliciesModuleScreen() {
  const { t } = useAppLocale();
  const authorization = useAdminAuthorization();
  const [detail, setDetail] = useState<PlacementPolicyDetailDto | null>(null);
  const [nodes, setNodes] = useState<readonly ScopeNodeOption[]>([]);
  const [nodesLoading, setNodesLoading] = useState(true);
  const [typeOptions, setTypeOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [moduleState, updateModuleState] = useAdminModuleState("model.placement-policies", { detailPolicyKey: "" });
  const resource = useMemo(() => defineAdminResource<PlacementPolicyListItemDto>({
    key: "placement-policies",
    moduleKey: "model.placement-policies",
    label: t("admin.placementPolicies"),
    description: t("admin.placementPoliciesDescription"),
    permissions: { read: ["system.config.read"], create: ["system.config"], update: ["system.config"], delete: ["system.config"] },
    list: {
      realtimeDependencies: ["placement-policies", "placement-policy"],
      load: async () => {
        const result = await AppCache.admin.listPlacementPolicies();
        if (!result.success || !result.data) throw new Error(result.error?.message ?? t("admin.loading"));
        return result.data;
      },
      columns: [
        { key: "name", label: t("admin.name"), render: (row) => row.name },
        { key: "key", label: t("admin.policyKey"), render: (row) => row.policyKey },
        { key: "mode", label: t("admin.policyMode"), render: (row) => t(`admin.policyMode.${row.policyMode}`) },
        { key: "rules", label: t("admin.rules"), render: (row) => row.ruleCount },
      ],
      emptyLabel: t("admin.noPolicies"),
      loadingLabel: t("admin.loadingPolicies"),
    },
  }), [t]);
  const controller = useAdminResourceController(resource, undefined);
  const canCreate = canUseAdminResourceOperation(resource, "create", authorization.permissions);
  const canUpdate = canUseAdminResourceOperation(resource, "update", authorization.permissions);
  const canDelete = canUseAdminResourceOperation(resource, "delete", authorization.permissions);
  const policySurface = useAdminFormSurface<PolicyForm>({ moduleKey: resource.moduleKey, surfaceKey: "policy-form", surfaceKind: "drawer", draftKey: "admin.model.placement-policy.form", formVersion: "2", initialValues: EMPTY_POLICY });
  const ruleSurface = useAdminFormSurface<RuleForm>({ moduleKey: resource.moduleKey, surfaceKey: "rule-form", surfaceKind: "modal", draftKey: "admin.model.placement-policy.rule-form", formVersion: "2", initialValues: EMPTY_RULE });
  const editing = policySurface.mode === "edit" && policySurface.resourceId ? controller.rows.find((row) => row.id === policySurface.resourceId) ?? null : null;
  const policyDefinition = useMemo(() => createPolicyForm(t, policySurface.mode === "edit"), [policySurface.mode, t]);
  const ruleDefinition = useMemo(() => createRuleForm(t, nodes, typeOptions, nodesLoading), [nodes, nodesLoading, t, typeOptions]);

  useEffect(() => {
    void Promise.all([AppCache.admin.listNodeTypes(), loadVisibleScopeNodes()]).then(([types, visibleNodes]) => {
      setTypeOptions((types as Array<{ id: string; name?: string; typeKey?: string }>).map((item) => ({ value: item.id, label: item.name ?? item.typeKey ?? item.id })));
      setNodes(visibleNodes);
      setNodesLoading(false);
    }).catch(() => {
      setNodesLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!moduleState.detailPolicyKey) return;
    void AppCache.admin.getPlacementPolicyByKey(moduleState.detailPolicyKey).then((result) => {
      if (result.success && result.data) setDetail(result.data);
    });
  }, [moduleState.detailPolicyKey]);
  const visibleDetail = moduleState.detailPolicyKey === detail?.policyKey ? detail : null;

  const refreshDetail = async (policyKey: string) => {
    const result = await AppCache.admin.getPlacementPolicyByKey(policyKey);
    if (!result.success || !result.data) throw new Error(result.error?.message ?? t("admin.loading"));
    setDetail(result.data);
  };

  const openCreate = () => {
    policySurface.complete();
    policySurface.open({ mode: "create" });
  };

  const openEdit = (row: PlacementPolicyListItemDto) => {
    policySurface.complete();
    policySurface.initialize({ policyKey: row.policyKey, name: row.name, description: row.description, policyMode: row.policyMode });
    policySurface.open({ mode: "edit", resourceId: row.id });
  };

  const submitPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = { policyKey: policySurface.values.policyKey.trim(), name: policySurface.values.name.trim(), description: policySurface.values.description.trim(), policyMode: policySurface.values.policyMode as PlacementPolicyListItemDto["policyMode"] };
    const succeeded = await controller.controller.executeAction({ key: editing ? "update" : "create", label: t("admin.saveChanges"), execute: async () => {
      const result = editing ? await AppCache.admin.updatePlacementPolicy({ ...values, expectedRowVersion: editing.rowVersion }) : await AppCache.admin.createPlacementPolicy(values);
      if (!result.success) throw new Error(result.error?.message ?? t("admin.loading"));
    } }, editing ?? ({ id: "new" } as PlacementPolicyListItemDto));
    if (succeeded) policySurface.complete();
  };

  const deletePolicy = async (row: PlacementPolicyListItemDto) => {
    const confirmed = await requestConfirmation({ title: t("admin.deletePolicyTitle"), description: t("admin.deletePolicyDescription"), confirmLabel: t("admin.delete"), cancelLabel: t("admin.cancel"), tone: "danger" });
    if (!confirmed) return;
    await controller.controller.executeAction({ key: "delete", label: t("admin.delete"), execute: async () => {
      const result = await AppCache.admin.deletePlacementPolicy({ policyKey: row.policyKey, expectedRowVersion: row.rowVersion });
      if (!result.success) throw new Error(result.error?.message ?? t("admin.deletePolicyTitle"));
    } }, row);
  };

  const createRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const policyKey = ruleSurface.resourceId;
    const row = controller.rows.find((item) => item.policyKey === policyKey);
    if (!policyKey || !row) return;
    const succeeded = await controller.controller.executeAction({ key: "create-rule", label: t("admin.addRule"), execute: async () => {
      const result = await AppCache.admin.createPlacementRule({ policyKey, ruleType: ruleSurface.values.ruleType, targetNodeId: ruleSurface.values.targetNodeId || undefined, targetNodeTypeId: ruleSurface.values.targetNodeTypeId || undefined, comparator: ruleSurface.values.comparator || undefined, valueText: ruleSurface.values.valueText || undefined });
      if (!result.success) throw new Error(result.error?.message ?? t("admin.addRule"));
    } }, row);
    if (succeeded) {
      ruleSurface.complete();
      await refreshDetail(policyKey);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!detail) return;
    const confirmed = await requestConfirmation({ title: t("admin.deleteRule"), confirmLabel: t("admin.delete"), cancelLabel: t("admin.cancel"), tone: "danger" });
    const row = controller.rows.find((item) => item.policyKey === detail.policyKey);
    if (!confirmed || !row) return;
    const succeeded = await controller.controller.executeAction({ key: "delete-rule", label: t("admin.deleteRule"), execute: async () => {
      const result = await AppCache.admin.deletePlacementRule({ ruleId });
      if (!result.success) throw new Error(result.error?.message ?? t("admin.deleteRule"));
    } }, row);
    if (succeeded) await refreshDetail(detail.policyKey);
  };

  const screen: AdminCollectionDefinition<PlacementPolicyListItemDto> = {
    title: resource.label,
    description: resource.description,
    icon: "settings",
    columns: resource.list.columns,
    loadingLabel: resource.list.loadingLabel,
    emptyLabel: resource.list.emptyLabel,
    rows: controller.rows,
    loading: controller.loading,
    error: controller.error,
    createLabel: canCreate ? t("admin.createPolicy") : undefined,
    onCreate: canCreate ? openCreate : undefined,
    onOpen: (row) => updateModuleState({ detailPolicyKey: row.policyKey }),
    rowLabel: (row) => row.name,
    actionMenuLabel: t("admin.actions"),
    refreshLabel: t("admin.refresh"),
    onRefresh: () => void controller.refresh(),
    pagination: { stateKey: resource.moduleKey },
    actions: [
      { key: "edit", label: t("admin.edit"), tone: "primary", onClick: openEdit, hidden: () => !canUpdate },
      { key: "delete", label: t("admin.delete"), tone: "danger", onClick: (row) => void deletePolicy(row), hidden: () => !canDelete },
    ],
  };

  return (
    <>
      <AdminCollectionScreen definition={screen} />
      {policySurface.isOpen && (
        <AdminFormDialog
          title={editing ? t("admin.editPolicy") : t("admin.createPolicy")}
          definition={policyDefinition}
          values={policySurface.values}
          pending={controller.pending}
          submitLabel={t("admin.saveChanges")}
          cancelLabel={t("admin.cancel")}
          onChange={(name, value) => policySurface.setValues((current) => ({
            ...current,
            [name]: value,
          }))}
          onSubmit={(event) => void submitPolicy(event)}
          onClose={() => void policySurface.close()}
        />
      )}
      {visibleDetail && (
        <AdminSurfaceHost definition={POLICY_DETAIL_SURFACE} onClose={() => updateModuleState({ detailPolicyKey: "" })} labelledBy="placement-policy-detail-title">
          <AdminSurfaceHeader
            title={visibleDetail.name}
            titleId="placement-policy-detail-title"
            subtitle={visibleDetail.policyKey}
            closeLabel={t("admin.close")}
            onClose={() => updateModuleState({ detailPolicyKey: "" })}
          />
          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-semibold text-slate-900">{t("admin.rules")}</h3>
              {canUpdate && (
                <AdminButton
                  tone="primary"
                  icon="plus"
                  onClick={() => ruleSurface.open({
                    mode: "create",
                    resourceId: visibleDetail.policyKey,
                  })}
                >
                  {t("admin.addRule")}
                </AdminButton>
              )}
            </div>
            {visibleDetail.rules.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">{t("admin.noRules")}</p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 border border-slate-200">
                {visibleDetail.rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                    <span>
                      {t(`admin.ruleType.${rule.ruleType}`)} · {rule.targetNodeName ?? rule.targetNodeTypeName ?? rule.valueText ?? "—"}
                    </span>
                    {canUpdate && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-700 hover:underline"
                        onClick={() => void deleteRule(rule.id)}
                      >
                        {t("admin.deleteRule")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </AdminSurfaceHost>
      )}
      {ruleSurface.isOpen && (
        <AdminFormDialog
          title={t("admin.addRule")}
          definition={ruleDefinition}
          values={ruleSurface.values}
          pending={controller.pending}
          submitLabel={t("admin.saveChanges")}
          cancelLabel={t("admin.cancel")}
          onChange={(name, value) => ruleSurface.setValues((current) => ({
            ...current,
            [name]: value,
          } as RuleForm))}
          onSubmit={(event) => void createRule(event)}
          onClose={() => void ruleSurface.close()}
        />
      )}
    </>
  );
}
