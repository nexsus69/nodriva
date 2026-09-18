"use client";

/** Loads the authorized, existing read models used by the administration dashboard. */
import { useCallback, useEffect, useState } from "react";
import type {
  AuditLogListItemDto,
  RuntimeCapabilityDto,
  TypeListItemDto,
  WorkflowDefinition,
} from "@dashboard/core";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";

export type AdminOverviewLoadState = "hidden" | "loading" | "ready" | "unavailable";

export interface AdminOverviewRead<T> {
  state: AdminOverviewLoadState;
  data: readonly T[];
  error: string | null;
}

export interface AdminOverviewSnapshot {
  capabilities: AdminOverviewRead<RuntimeCapabilityDto>;
  workflows: AdminOverviewRead<WorkflowDefinition>;
  nodeTypes: AdminOverviewRead<TypeListItemDto>;
  entityTypes: AdminOverviewRead<TypeListItemDto>;
  auditRecords: AdminOverviewRead<AuditLogListItemDto>;
  refresh: () => void;
}

const hiddenRead = <T,>(): AdminOverviewRead<T> => ({ state: "hidden", data: [], error: null });
const loadingRead = <T,>(): AdminOverviewRead<T> => ({ state: "loading", data: [], error: null });

function toRead<T>(result: { success: boolean; data?: T[]; error?: { message?: string } }): AdminOverviewRead<T> {
  if (result.success && result.data) return { state: "ready", data: result.data, error: null };
  return {
    state: "unavailable",
    data: [],
    error: result.error?.message ?? "",
  };
}

/** Keeps independent data failures visible without withholding the rest of the dashboard. */
export function useAdminOverview(): AdminOverviewSnapshot {
  const { permissions } = useAdminAuthorization();
  const canReadSystem = permissions.has("system.config.read");
  const canReadNodeTypes = permissions.has("node_type.read");
  const canReadEntityTypes = permissions.has("entity_type.read");
  const canReadAudit = permissions.has("audit.access");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<Omit<AdminOverviewSnapshot, "refresh">>(() => ({
    capabilities: canReadSystem ? loadingRead() : hiddenRead(),
    workflows: canReadSystem ? loadingRead() : hiddenRead(),
    nodeTypes: canReadNodeTypes ? loadingRead() : hiddenRead(),
    entityTypes: canReadEntityTypes ? loadingRead() : hiddenRead(),
    auditRecords: canReadAudit ? loadingRead() : hiddenRead(),
  }));

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      canReadSystem ? AppCache.admin.listCapabilities() : undefined,
      canReadSystem ? AppCache.admin.listWorkflowDefinitions() : undefined,
      canReadNodeTypes ? AppCache.admin.listTypes("node") : undefined,
      canReadEntityTypes ? AppCache.admin.listTypes("entity") : undefined,
      canReadAudit ? AppCache.adminAudits.read({ page: 1, pageSize: 5 }) : undefined,
    ]).then(([capabilities, workflows, nodeTypes, entityTypes, auditRecords]) => {
      if (cancelled) return;
      setSnapshot({
        capabilities: capabilities ? toRead(capabilities) : hiddenRead(),
        workflows: workflows ? toRead(workflows) : hiddenRead(),
        nodeTypes: nodeTypes ? toRead(nodeTypes) : hiddenRead(),
        entityTypes: entityTypes ? toRead(entityTypes) : hiddenRead(),
        auditRecords: auditRecords
          ? { state: "ready", data: auditRecords.items, error: null }
          : hiddenRead(),
      });
    }).catch(() => {
      if (cancelled) return;
      setSnapshot((current) => Object.fromEntries(
        Object.entries(current).map(([key, read]) => [
          key,
          read.state === "loading" ? { state: "unavailable", data: [], error: "" } : read,
        ]),
      ) as Omit<AdminOverviewSnapshot, "refresh">);
    });

    return () => {
      cancelled = true;
    };
  }, [canReadAudit, canReadEntityTypes, canReadNodeTypes, canReadSystem, refreshVersion]);

  const refresh = useCallback(() => {
    setSnapshot((current) => Object.fromEntries(
      Object.entries(current).map(([key, read]) => [
        key,
        read.state === "hidden" ? read : loadingRead(),
      ]),
    ) as Omit<AdminOverviewSnapshot, "refresh">);
    AppCache.admin.invalidate(["capabilities", "workflow-definitions", "types", "audit"]);
    setRefreshVersion((version) => version + 1);
  }, []);

  return { ...snapshot, refresh };
}
