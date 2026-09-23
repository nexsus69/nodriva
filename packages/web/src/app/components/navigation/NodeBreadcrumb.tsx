'use client';

import { useSemanticNodeBreadcrumb } from '../../hooks/useSemanticNodeBreadcrumb';
import { LockIndicator } from '../LockIndicator';
import { HomeBreadcrumbIcon, ResponsiveBreadcrumb, type BreadcrumbItem } from './Breadcrumb';
import { Skeleton, SkeletonState } from '../ui/feedback';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

export interface NodeBreadcrumbProps {
  nodeId: string;
  /** The current node is normally plain text; entity pages can link back to it. */
  currentNodeLinkable?: boolean;
}

export function NodeBreadcrumb({ nodeId, currentNodeLinkable = false }: NodeBreadcrumbProps) {
  const { nodes, isLoading, error, retry } = useSemanticNodeBreadcrumb(nodeId);
  const { t } = useAppLocale();

  const items: BreadcrumbItem[] = [
    { label: t('workspace.title'), href: '/', icon: <HomeBreadcrumbIcon /> },
    ...nodes.map((node, index) => ({
      label: node.name,
      href: index === nodes.length - 1 && !currentNodeLinkable ? null : `/nodes/${node.id}`,
      suffix: <LockIndicator resourceType="node" resourceId={node.id} className="-translate-y-px" />,
    })),
  ];
  if (error && nodes.length === 0) items.push({ label: t('breadcrumb.unavailable'), href: null });

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ResponsiveBreadcrumb items={items} ariaLabel={t('breadcrumb.nodes')} />
      {isLoading && nodes.length === 0 && (
        <SkeletonState label={t('breadcrumb.loading')} className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
          <span aria-hidden="true">/</span><Skeleton className="h-3 w-12 shrink-0 rounded-sm" />
          <span aria-hidden="true" className="hidden sm:inline">/</span><Skeleton className="hidden h-3 w-16 shrink-0 rounded-sm sm:block" />
        </SkeletonState>
      )}
      {error && (
        <button type="button" onClick={() => void retry()} className="shrink-0 text-[11px] font-semibold text-rose-600 underline">
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
