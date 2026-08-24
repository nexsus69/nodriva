import { AppCache } from "@/app/cache/GlobalCacheClient";

/** Describes a visible node option used by role-scope selectors. */
export interface ScopeNodeOption {
  id: string;
  parentId: string | null;
  name: string;
  pathLabel: string;
}

/**
 * Loads every node visible to the current actor for scope assignment.
 * The cache exposes children by parent, so this helper performs the traversal
 * once and gives every scope form the same complete node catalogue.
 */
export async function loadVisibleScopeNodes(): Promise<ScopeNodeOption[]> {
  const visited = new Set<string>();
  const result: ScopeNodeOption[] = [];

  async function visit(parentId: string | null): Promise<void> {
    const children = await AppCache.admin.listChildren(parentId);
    await Promise.all(children.map(async (node) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      result.push({
        id: node.id,
        parentId: node.parentId,
        name: node.name,
        pathLabel: node.pathLabel || node.name,
      });
      await visit(node.id);
    }));
  }

  await visit(null);
  return result.sort((left, right) => left.pathLabel.localeCompare(right.pathLabel));
}
