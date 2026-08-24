"use client";

/** Provides restore and purge workflows through the shared collection lifecycle. */
import { useMemo } from "react";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { requestConfirmation } from "@/app/components/ui/feedback/ConfirmDialogStore";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import {
  AdminCollectionScreen,
  type AdminCollectionDefinition,
} from "@/adminPanel/components/AdminCollectionScreen";
import { useAdminResourceController } from "@/adminPanel/useAdminResourceController";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";

interface RecycleRow {
  id: string;
  kind: "node" | "entity";
  name: string;
  detail: string;
  rowVersion: number;
}

async function unwrap<T>(
  result: Promise<{
    success: boolean;
    data?: T;
    error?: { message: string };
  }>,
): Promise<T> {
  const resolved = await result;
  if (!resolved.success || resolved.data === undefined) {
    throw new Error(resolved.error?.message ?? "Administrative operation failed.");
  }
  return resolved.data;
}

/** Renders the only collection whose actions span node and entity resources. */
export function RecycleBinModuleScreen() {
  const { t } = useAppLocale();
  const authorization = useAdminAuthorization();
  const resource = useMemo(
    () =>
      defineAdminResource<RecycleRow>({
        key: "recycle-bin",
        moduleKey: "activity.recycle-bin",
        label: t("admin.recycleBin"),
        description: t("admin.recycleBinDescription"),
        list: {
          load: async () => {
            const [nodes, entities] = await Promise.all([
              unwrap(AppCache.admin.listDeletedNodes()),
              unwrap(AppCache.admin.listDeletedEntities()),
            ]);
            return [
              ...(nodes as Array<{
                id: string;
                name: string;
                path: string;
                rowVersion: number;
              }>).map((row) => ({
                id: row.id,
                kind: "node" as const,
                name: row.name,
                detail: row.path,
                rowVersion: row.rowVersion,
              })),
              ...(entities as Array<{
                id: string;
                name: string;
                entityTypeName: string;
                rowVersion: number;
              }>).map((row) => ({
                id: row.id,
                kind: "entity" as const,
                name: row.name,
                detail: row.entityTypeName,
                rowVersion: row.rowVersion,
              })),
            ];
          },
          columns: [
            { key: "kind", label: t("admin.resourceKind"), render: (row) => row.kind },
            { key: "name", label: t("admin.name"), render: (row) => row.name },
            { key: "detail", label: t("admin.description"), render: (row) => row.detail },
          ],
          emptyLabel: t("admin.noRecords"),
          loadingLabel: t("admin.loading"),
        },
      }),
    [t],
  );
  const controller = useAdminResourceController(resource, undefined);

  const execute = async (row: RecycleRow, operation: "restore" | "purge") => {
    const confirmed = await requestConfirmation({
      title: t(operation === "restore" ? "admin.restoreTitle" : "admin.purgeTitle"),
      description: t(
        operation === "restore"
          ? "admin.restoreDescription"
          : "admin.purgeDescription",
      ),
      confirmLabel: t(operation === "restore" ? "admin.restore" : "admin.purge"),
      cancelLabel: t("admin.cancel"),
      tone: operation === "purge" ? "danger" : "neutral",
    });
    if (!confirmed) return;

    await controller.controller.executeAction(
      {
        key: operation,
        label: operation,
        execute: async () => {
          if (operation === "restore" && row.kind === "node") {
            await unwrap(
              AppCache.admin.restoreDeletedNode({
                nodeId: row.id,
                expectedRowVersion: row.rowVersion,
              }),
            );
          } else if (operation === "restore") {
            await unwrap(
              AppCache.admin.restoreDeletedEntity({
                entityId: row.id,
                expectedRowVersion: row.rowVersion,
              }),
            );
          } else if (row.kind === "node") {
            await unwrap(
              AppCache.admin.purgeDeletedNode({
                nodeId: row.id,
                confirmation: "ELIMINA DEFINITIVAMENTE",
              }),
            );
          } else {
            await unwrap(
              AppCache.admin.purgeDeletedEntity({
                entityId: row.id,
                confirmation: "ELIMINA DEFINITIVAMENTE",
              }),
            );
          }
        },
      },
      row,
    );
  };

  const definition: AdminCollectionDefinition<RecycleRow> = {
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
    onRefresh: () => void controller.reload(),
    actions: [
      {
        key: "restore",
        label: t("admin.restore"),
        tone: "primary",
        onClick: (row) => void execute(row, "restore"),
        hidden: (row) => !authorization.permissions.has(`${row.kind}.restore`),
      },
      {
        key: "purge",
        label: t("admin.purge"),
        tone: "danger",
        onClick: (row) => void execute(row, "purge"),
        hidden: (row) => !authorization.permissions.has(`${row.kind}.purge`),
      },
    ],
  };

  return <AdminCollectionScreen definition={definition} />;
}
