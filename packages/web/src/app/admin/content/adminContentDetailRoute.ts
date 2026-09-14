/** Defines Admin-only resource detail paths without granting additional access. */
export type AdminContentDetailRoute =
  | { kind: 'node'; nodeId: string }
  | { kind: 'entity'; parentNodeId: string; entityId: string };

export function adminNodeDetailHref(nodeId: string): string {
  return `/admin/content/nodes/${encodeURIComponent(nodeId)}`;
}

export function adminEntityDetailHref(parentNodeId: string, entityId: string): string {
  return `/admin/content/entities/${encodeURIComponent(parentNodeId)}/${encodeURIComponent(entityId)}`;
}

export function parseAdminContentDetailRoute(pathname: string): AdminContentDetailRoute | null {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== 'admin' || parts[1] !== 'content') return null;
  if (parts[2] === 'nodes' && parts.length === 4) return { kind: 'node', nodeId: parts[3]! };
  if (parts[2] === 'entities' && parts.length === 5) {
    return { kind: 'entity', parentNodeId: parts[3]!, entityId: parts[4]! };
  }
  return null;
}
