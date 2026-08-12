'use client';

import { AppCache } from '../../cache/GlobalCacheClient';
import { useAppCacheRevision } from '../../hooks/useAppCacheRevision';
import { buildCachedBreadcrumbPath } from './nodeBreadcrumbPath';
import { LockIndicator } from '../LockIndicator';
import { HomeBreadcrumbIcon, ResponsiveBreadcrumb, type BreadcrumbItem } from './Breadcrumb';

export interface NodeBreadcrumbProps {
  nodeId: string;
  /** The current node is normally plain text; entity pages can link back to it. */
  currentNodeLinkable?: boolean;
}

export function NodeBreadcrumb({ nodeId, currentNodeLinkable = false }: NodeBreadcrumbProps) {
  const cacheRevision = useAppCacheRevision();
  void cacheRevision;

  const { nodes, isComplete } = buildCachedBreadcrumbPath(
    nodeId,
    (id) => AppCache.nodes.get(id),
    AppCache.isVirtualRootNode
  );

  const items: BreadcrumbItem[] = [
    { label: 'Workspace', href: '/', icon: <HomeBreadcrumbIcon /> },
    ...nodes.map((node, index) => ({
      label: node.name,
      href: index === nodes.length - 1 && !currentNodeLinkable ? null : `/nodes/${node.id}`,
      suffix: <LockIndicator resourceType="node" resourceId={node.id} className="-translate-y-px" />,
    })),
  ];
  if (!isComplete) items.splice(1, 0, { label: 'Catena in caricamento', href: null });
  if (nodes.length === 0) items.push({ label: nodeId, href: null });
  return <ResponsiveBreadcrumb items={items} ariaLabel="Breadcrumb nodi" />;
}
