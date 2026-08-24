/** Builds scoped Admin content projections through the canonical client cache. */
import type { ClientNode } from "@/app/types/models";
import { AppCache } from "@/app/cache/GlobalCacheClient";

export interface AdminNodeRow extends ClientNode {
  typeLabel: string;
}

export interface AdminEntityRow {
  id: string;
  parentNodeId: string;
  entityTypeId: string;
  name: string;
  description: string;
  rowVersion: number;
  nodeName: string;
  nodePath: string;
  typeLabel: string;
}

/** Loads the visible hierarchy exactly once and retains canonical node records. */
export async function loadAdminNodeRows(): Promise<AdminNodeRow[]> {
  const [types, roots] = await Promise.all([
    AppCache.metadata.list("node"),
    AppCache.admin.listChildren(null),
  ]);
  const typeNames = new Map(types.map((type) => [type.id, type.name]));
  const visited = new Set<string>();
  const rows: ClientNode[] = [];
  let level = [...roots];

  while (level.length > 0) {
    const current = level.filter((node) => !visited.has(node.id));
    current.forEach((node) => {
      visited.add(node.id);
      rows.push(node);
    });
    const children = await Promise.all(
      current.map((node) => AppCache.admin.listChildren(node.id)),
    );
    level = children.flat();
  }

  return rows
    .map((node) => ({
      ...node,
      typeLabel: typeNames.get(node.nodeTypeId) ?? node.nodeTypeId,
    }))
    .sort((left, right) => left.pathLabel.localeCompare(right.pathLabel));
}

/** Loads every scoped entity page and removes overlap between virtual roots. */
export async function loadAdminEntityRows(): Promise<AdminEntityRow[]> {
  const [types, roots] = await Promise.all([
    AppCache.metadata.list("entity"),
    AppCache.admin.listChildren(null),
  ]);
  const typeNames = new Map(types.map((type) => [type.id, type.name]));
  const rows = new Map<string, AdminEntityRow>();

  for (const root of roots) {
    let cursor: { path: string; name: string; id: string } | undefined;
    do {
      const page = await AppCache.admin.listSubtreeEntities({
        baseNodeId: root.id,
        limit: 200,
        direction: "forward",
        cursor,
      });
      page.items.forEach((entity) => {
        rows.set(entity.id, {
          id: entity.id,
          parentNodeId: entity.parentNodeId,
          entityTypeId: entity.entityTypeId,
          name: entity.name,
          description: entity.description,
          rowVersion: entity.rowVersion,
          nodeName: entity.nodeName,
          nodePath: entity.nodePath,
          typeLabel: typeNames.get(entity.entityTypeId) ?? entity.entityTypeId,
        });
      });
      if (page.hasMore && !page.nextCursor) {
        throw new Error("The entity catalogue returned an incomplete pagination cursor.");
      }
      cursor = page.hasMore ? page.nextCursor : undefined;
    } while (cursor);
  }

  return [...rows.values()].sort(
    (left, right) => left.nodePath.localeCompare(right.nodePath) || left.name.localeCompare(right.name),
  );
}
