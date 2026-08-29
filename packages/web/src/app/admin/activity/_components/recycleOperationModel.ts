/** Groups deleted resources by the user action that caused their removal. */
import type {
  DeletedEntityListItem,
  DeletedNodeListItem,
} from "@/app/actions/recycleActions";

export interface RecycleOperation {
  id: string;
  kind: "node_subtree" | "entity";
  name: string;
  detail: string;
  deletedAt: string;
  rowVersion: number;
  affectedNodeCount: number;
  affectedEntityCount: number;
}

/** Exposes only independently actionable deletes; batch descendants stay in their root operation. */
export function toRecycleOperations(
  nodes: readonly DeletedNodeListItem[],
  entities: readonly DeletedEntityListItem[],
): RecycleOperation[] {
  const nodeOperations = nodes
    .filter((node) => node.isDeletionRoot)
    .map((node) => ({
      id: node.id,
      kind: "node_subtree" as const,
      name: node.name,
      detail: node.path,
      deletedAt: node.deletedAt,
      rowVersion: node.rowVersion,
      affectedNodeCount: node.affectedNodeCount,
      affectedEntityCount: node.affectedEntityCount,
    }));
  const entityOperations = entities
    .filter((entity) => entity.deletionBatchId === null)
    .map((entity) => ({
      id: entity.id,
      kind: "entity" as const,
      name: entity.name,
      detail: entity.entityTypeName,
      deletedAt: entity.deletedAt,
      rowVersion: entity.rowVersion,
      affectedNodeCount: 0,
      affectedEntityCount: 1,
    }));
  return [...nodeOperations, ...entityOperations]
    .sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
}
