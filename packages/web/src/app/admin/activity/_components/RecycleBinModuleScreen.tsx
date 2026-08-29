"use client";

/** Presents recoverable user operations rather than the individual records they affected. */
import { useMemo } from "react";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { requestConfirmation } from "@/app/components/ui/feedback/ConfirmDialogStore";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { toRecycleOperations, type RecycleOperation } from "./recycleOperationModel";

async function unwrap<T>(result: Promise<{ success: boolean; data?: T; error?: { message: string } }>): Promise<T> {
  const resolved = await result;
  if (!resolved.success || resolved.data === undefined) throw new Error(resolved.error?.message ?? "Administrative operation failed.");
  return resolved.data;
}

/** Gives the confirmation an explicit impact instead of pretending a batch is one record. */
function operationImpact(operation: RecycleOperation, t: (key: string) => string): string {
  if (operation.kind === "entity") return t("admin.recycleSingleEntityImpact");
  return t("admin.recycleSubtreeImpact")
    .replace("{nodes}", String(operation.affectedNodeCount))
    .replace("{entities}", String(operation.affectedEntityCount));
}

/** Renders one causal recycle operation with restore/purge actions limited to its actual root. */
export function RecycleBinModuleScreen() {
  const { t } = useAppLocale();
  const authorization = useAdminAuthorization();
  const resource = useMemo(() => defineAdminResource<RecycleOperation>({
    key: "recycle-bin",
    moduleKey: "activity.recycle-bin",
    label: t("admin.recycleBin"),
    description: t("admin.recycleBinDescription"),
    list: {
      realtimeDependencies: ["deleted-nodes", "deleted-entities"],
      load: async () => {
        const [nodes, entities] = await Promise.all([
          unwrap(AppCache.admin.listDeletedNodes()),
          unwrap(AppCache.admin.listDeletedEntities()),
        ]);
        return toRecycleOperations(nodes, entities);
      },
      columns: [
        { key: "kind", label: t("admin.resourceKind"), render: (row) => row.kind === "node_subtree" ? t("admin.recycleSubtree") : t("admin.entity") },
        { key: "name", label: t("admin.name"), render: (row) => row.name },
        { key: "impact", label: t("admin.recycleImpact"), render: (row) => operationImpact(row, t) },
        { key: "deletedAt", label: t("admin.recycleDeletedAt"), render: (row) => row.deletedAt },
      ],
      emptyLabel: t("admin.recycleBinEmpty"),
      loadingLabel: t("admin.loading"),
    },
  }), [t]);
  const controller = useAdminResourceController(resource, undefined);

  const execute = async (operation: RecycleOperation, action: "restore" | "purge") => {
    const confirmed = await requestConfirmation({
      title: t(action === "restore" ? "admin.recycleRestoreTitle" : "admin.recyclePurgeTitle"),
      description: `${operation.name}. ${operationImpact(operation, t)}`,
      confirmLabel: t(action === "restore" ? "admin.recycleRestoreOperation" : "admin.recyclePurgeOperation"),
      cancelLabel: t("admin.cancel"),
      tone: action === "purge" ? "danger" : "neutral",
    });
    if (!confirmed) return;

    await controller.controller.executeAction({
      key: action,
      label: action,
      execute: async () => {
        if (action === "restore" && operation.kind === "node_subtree") {
          await unwrap(AppCache.admin.restoreDeletedNode({ nodeId: operation.id, expectedRowVersion: operation.rowVersion }));
        } else if (action === "restore") {
          await unwrap(AppCache.admin.restoreDeletedEntity({ entityId: operation.id, expectedRowVersion: operation.rowVersion }));
        } else if (operation.kind === "node_subtree") {
          await unwrap(AppCache.admin.purgeDeletedNode({ nodeId: operation.id, confirmation: "ELIMINA DEFINITIVAMENTE" }));
        } else {
          await unwrap(AppCache.admin.purgeDeletedEntity({ entityId: operation.id, confirmation: "ELIMINA DEFINITIVAMENTE" }));
        }
      },
    }, operation);
  };

  const definition: AdminCollectionDefinition<RecycleOperation> = {
    title: resource.label,
    description: resource.description,
    icon: "recycle",
    columns: resource.list.columns,
    rows: controller.rows,
    loading: controller.loading,
    error: controller.error,
    loadingLabel: resource.list.loadingLabel,
    emptyLabel: resource.list.emptyLabel,
    pagination: { stateKey: resource.moduleKey },
    actionMenuLabel: t("admin.actions"),
    refreshLabel: t("admin.refresh"),
    onRefresh: () => void controller.refresh(),
    rowLabel: (row) => row.name,
    actions: [
      {
        key: "restore",
        label: t("admin.recycleRestoreOperation"),
        tone: "primary",
        onClick: (row) => void execute(row, "restore"),
        hidden: (row) => !authorization.permissions.has(row.kind === "node_subtree" ? "node.restore" : "entity.restore"),
      },
      {
        key: "purge",
        label: t("admin.recyclePurgeOperation"),
        tone: "danger",
        onClick: (row) => void execute(row, "purge"),
        hidden: (row) => !authorization.permissions.has(row.kind === "node_subtree" ? "node.purge" : "entity.purge"),
      },
    ],
  };
  return <AdminCollectionScreen definition={definition} />;
}
