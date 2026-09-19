"use client";

/** Presents recoverable user operations rather than the individual records they affected. */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { requestConfirmation } from "@/app/components/ui/feedback/ConfirmDialogStore";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import type { AdminTableColumn } from "@/adminPanel/components/AdminTable";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { useAdminRemotePagination } from "@/adminPanel/useAdminRemotePagination";
import { useAdminRealtimeCollectionRefresh } from "@/adminPanel/useAdminRealtimeCollectionRefresh";
import { refreshAdminCollection } from "@/adminPanel/refreshAdminCollection";
import type { RecycleBinOperationItem as RecycleOperation } from "@dashboard/core";

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
  const [rows, setRows] = useState<readonly RecycleOperation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestVersion = useRef(0);
  const pagination = useAdminRemotePagination({ total, stateKey: "governance.recycle-bin" });
  const load = useCallback(async (requestedPage = pagination.page) => {
    const version = ++requestVersion.current; setLoading(true);
    try {
      const result = await AppCache.adminRecycleBin.read({ page: requestedPage, pageSize: pagination.pageSize });
      if (version !== requestVersion.current) return;
      setRows(result.items); setTotal(result.total); pagination.setPage(result.page); setError(null);
    } catch (cause) { if (version === requestVersion.current) setError(cause instanceof Error ? cause : new Error(String(cause))); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [pagination]);
  useEffect(() => {
    void Promise.resolve().then(() => load());
    // Initial loading intentionally runs once; page and realtime are explicit transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useAdminRealtimeCollectionRefresh(["deleted-nodes", "deleted-entities"], () => load(pagination.page));
  const columns: readonly AdminTableColumn<RecycleOperation>[] = [
        { key: "kind", label: t("admin.resourceKind"), render: (row) => row.kind === "node_subtree" ? t("admin.recycleSubtree") : t("admin.entity") },
        { key: "name", label: t("admin.name"), render: (row) => row.name },
        { key: "impact", label: t("admin.recycleImpact"), render: (row) => operationImpact(row, t) },
        { key: "deletedAt", label: t("admin.recycleDeletedAt"), render: (row) => row.deletedAt },
  ];

  const execute = async (operation: RecycleOperation, action: "restore" | "purge") => {
    const confirmed = await requestConfirmation({
      title: t(action === "restore" ? "admin.recycleRestoreTitle" : "admin.recyclePurgeTitle"),
      description: `${operation.name}. ${operationImpact(operation, t)}`,
      confirmLabel: t(action === "restore" ? "admin.recycleRestoreOperation" : "admin.recyclePurgeOperation"),
      cancelLabel: t("admin.cancel"),
      tone: action === "purge" ? "danger" : "neutral",
    });
    if (!confirmed) return;

    try {
        if (action === "restore" && operation.kind === "node_subtree") {
          await unwrap(AppCache.admin.restoreDeletedNode({ nodeId: operation.id, expectedRowVersion: operation.rowVersion }));
        } else if (action === "restore") {
          await unwrap(AppCache.admin.restoreDeletedEntity({ entityId: operation.id, expectedRowVersion: operation.rowVersion }));
        } else if (operation.kind === "node_subtree") {
          await unwrap(AppCache.admin.purgeDeletedNode({ nodeId: operation.id, confirmation: "ELIMINA DEFINITIVAMENTE" }));
        } else {
          await unwrap(AppCache.admin.purgeDeletedEntity({ entityId: operation.id, confirmation: "ELIMINA DEFINITIVAMENTE" }));
        }
      await load(pagination.page);
    } catch (cause) { setError(cause instanceof Error ? cause : new Error(String(cause))); }
  };

  const definition: AdminCollectionDefinition<RecycleOperation> = {
    title: t("admin.recycleBin"),
    description: t("admin.recycleBinDescription"),
    icon: "recycle",
    columns,
    rows,
    loading,
    error,
    loadingLabel: t("admin.loading"),
    emptyLabel: t("admin.recycleBinEmpty"),
    pagination: { mode: "remote", page: pagination.page, pageCount: pagination.pageCount, onPageChange: (page) => void load(page) },
    actionMenuLabel: t("admin.actions"),
    refreshLabel: t("admin.refresh"),
    onRefresh: () => void refreshAdminCollection(() => load(pagination.page)),
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
