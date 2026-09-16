"use client";

/** Renders scoped node and entity catalogues through one reusable Admin contract. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { defineAdminResource } from "@/adminPanel/AdminResourceDefinition";
import {
  AdminCollectionScreen,
  type AdminCollectionDefinition,
} from "@/adminPanel/components/AdminCollectionScreen";
import { useAdminContentCatalogue } from "./useAdminContentCatalogue";
import type { AdminTableSortState } from "@/adminPanel/components/AdminTable";
import { adminEntityDetailHref, adminNodeDetailHref } from '../adminContentDetailRoute';
import type { AdminEntityCatalogItem, AdminNodeCatalogItem } from "@dashboard/core";

type ContentKind = "node" | "entity";
type ContentRow = AdminNodeCatalogItem | AdminEntityCatalogItem;

/** Returns the Admin detail route for a scoped content record. */
function adminDetailHref(kind: ContentKind, row: ContentRow): string {
  return kind === "node"
    ? adminNodeDetailHref(row.id)
    : adminEntityDetailHref((row as AdminEntityCatalogItem).parentNodeId, row.id);
}

/** Hosts a scoped resource catalogue while canonical editors retain mutation ownership. */
export function AdminContentModuleScreen({ kind }: { kind: ContentKind }) {
  const { t } = useAppLocale();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AdminTableSortState | null>(null);
  const isNode = kind === "node";
  const resource = useMemo(() => defineAdminResource<ContentRow>({
    key: isNode ? "nodes" : "entities",
    moduleKey: isNode ? "content.nodes" : "content.entities",
    label: t(isNode ? "admin.nodes" : "admin.entities"),
    description: t(isNode ? "admin.nodesDescription" : "admin.entitiesDescription"),
    permissions: { read: [isNode ? "node.read" : "entity.read"] },
    list: {
      mode: "remote",
      realtimeDependencies: isNode ? ["children"] : ["subtree-entities"],
      columns: [
        {
          key: "name",
          label: t("admin.name"),
          render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
          sortValue: (row) => row.name,
        },
        {
          key: "type",
          label: t("admin.type"),
          render: (row) => row.typeLabel,
          sortValue: (row) => row.typeLabel,
        },
        {
          key: "path",
          label: t("admin.path"),
          render: (row) => isNode
            ? (row as AdminNodeCatalogItem).pathLabel
            : (row as AdminEntityCatalogItem).nodePath,
          sortValue: (row) => isNode
            ? (row as AdminNodeCatalogItem).pathLabel
            : (row as AdminEntityCatalogItem).nodePath,
          className: "max-w-md truncate text-slate-500",
        },
      ],
      emptyLabel: t(isNode ? "admin.noNodes" : "admin.noEntities"),
      loadingLabel: t(isNode ? "admin.loadingNodes" : "admin.loadingEntities"),
    },
  }), [isNode, t]);
  const collection = useAdminContentCatalogue(kind, search, sort);
  const visibleRows = collection.rows;
  const countTemplate = t(isNode ? "admin.nodeCount" : "admin.entityCount");
  const countLabel = countTemplate
    .replace("{visible}", String(visibleRows.length))
    .replace("{total}", String(collection.total));
  const open = (row: ContentRow) => router.push(adminDetailHref(kind, row));

  const definition: AdminCollectionDefinition<ContentRow> = {
    title: resource.label,
    description: resource.description,
    icon: isNode ? "nodes" : "entities",
    breadcrumbs: [{ label: t("admin.content") }],
    columns: resource.list.columns,
    rows: visibleRows,
    loading: collection.loading,
    error: collection.error,
    loadingLabel: resource.list.loadingLabel,
    emptyLabel: resource.list.emptyLabel,
    search: {
      value: search,
      label: t(isNode ? "admin.searchNodes" : "admin.searchEntities"),
      placeholder: t(isNode ? "admin.searchNodes" : "admin.searchEntities"),
      onChange: setSearch,
    },
    resultLabel: countLabel,
    refreshLabel: t("admin.refresh"),
    onRefresh: collection.refresh,
    onOpen: open,
    rowLabel: (row) => row.name,
    actionMenuLabel: t("admin.actions"),
    actions: [{
      key: "open-workspace",
      label: t("admin.openDetail"),
      icon: "external",
      tone: "primary",
      onClick: open,
    }],
    pagination: { mode: "remote", page: collection.pagination.page, pageCount: collection.pagination.pageCount, onPageChange: collection.loadPage, sort, onSortChange: setSort },
  };

  return <AdminCollectionScreen definition={definition} />;
}
