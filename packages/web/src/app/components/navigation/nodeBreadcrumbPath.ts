import type { ClientNode } from '../../types/models';

export interface CachedBreadcrumbPath {
  nodes: ClientNode[];
  isComplete: boolean;
}

export function buildCachedBreadcrumbPath(
  nodeId: string,
  getNode: (id: string) => ClientNode | null
): CachedBreadcrumbPath {
  const reversedPath: ClientNode[] = [];
  const visited = new Set<string>();
  let currentId: string | null = nodeId;
  let isComplete = true;

  while (currentId) {
    if (visited.has(currentId)) {
      isComplete = false;
      break;
    }
    visited.add(currentId);

    const node = getNode(currentId);
    if (!node) {
      isComplete = false;
      break;
    }

    reversedPath.push(node);
    currentId = node.parentId;
  }

  return {
    nodes: reversedPath.reverse(),
    isComplete,
  };
}
