import { isNodeAncestorOfPath } from './nodeTreePath';

export interface NodeTreeItemState {
  isActive: boolean;
  isActiveAncestor: boolean;
  isExpanded: boolean;
}

export function resolveNodeTreeItemState(
  node: { id: string; path: string },
  expandedNodeIds: ReadonlySet<string>,
  activeNodeId?: string,
  activeNodePath?: string,
): NodeTreeItemState {
  const isActive = node.id === activeNodeId;
  const isActiveAncestor = isNodeAncestorOfPath(node.path, activeNodePath);
  return {
    isActive,
    isActiveAncestor,
    isExpanded: expandedNodeIds.has(node.id) || isActiveAncestor,
  };
}

export function toggleNodeExpansion(
  expandedNodeIds: ReadonlySet<string>,
  nodeId: string,
): ReadonlySet<string> {
  const next = new Set(expandedNodeIds);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  return next;
}
