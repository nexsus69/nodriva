'use client';

import { useSemanticNodeBreadcrumb } from '../../hooks/useSemanticNodeBreadcrumb';
import { LockIndicator } from '../LockIndicator';
import { HomeBreadcrumbIcon, ResponsiveBreadcrumb, type BreadcrumbItem } from './Breadcrumb';

export interface NodeBreadcrumbProps {
  nodeId: string;
  /** The current node is normally plain text; entity pages can link back to it. */
  currentNodeLinkable?: boolean;
}

export function NodeBreadcrumb({ nodeId, currentNodeLinkable = false }: NodeBreadcrumbProps) {
  const { nodes, isLoading, error, retry } = useSemanticNodeBreadcrumb(nodeId);

  const items: BreadcrumbItem[] = [
    { label: 'Workspace', href: '/', icon: <HomeBreadcrumbIcon /> },
    ...nodes.map((node, index) => ({
      label: node.name,
      href: index === nodes.length - 1 && !currentNodeLinkable ? null : `/nodes/${node.id}`,
      suffix: <LockIndicator resourceType="node" resourceId={node.id} className="-translate-y-px" />,
    })),
  ];
  if (isLoading && nodes.length === 0) items.push({ label: 'Catena in caricamento', href: null });
  if (error && nodes.length === 0) items.push({ label: 'Breadcrumb non disponibile', href: null });

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ResponsiveBreadcrumb items={items} ariaLabel="Breadcrumb nodi" />
      {error && (
        <button type="button" onClick={() => void retry()} className="shrink-0 text-[11px] font-semibold text-rose-600 underline">
          Riprova
        </button>
      )}
    </div>
  );
}
