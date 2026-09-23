'use client';

import { NodeTree } from '../../../components/navigation/NodeTree';
import { Skeleton } from '../../../components/ui/feedback';
import { Panel, SectionHeader } from '../../../components/ui/layout';
import type { useNodeDetail } from '../_hooks/useNodeDetail';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

interface NodeContextOverviewProps { nodeId: string; controller: ReturnType<typeof useNodeDetail> }

export function NodeContextOverview({ nodeId, controller }: NodeContextOverviewProps) {
  const { currentNode, childNodes, nodeEntities, isMyLock, lockedByOther } = controller;
  const { t } = useAppLocale();
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <NodeTree activeNodeId={nodeId} activeNodePath={currentNode?.path} />
      <Panel as="aside">
        <SectionHeader title={t('node.summary')} description={t('node.context')} actions={<span className={`h-2.5 w-2.5 rounded-full ${isMyLock ? 'bg-emerald-500' : lockedByOther.locked ? 'bg-amber-500' : 'bg-slate-300'}`} title={isMyLock ? t('node.activeEdit') : lockedByOther.locked ? t('node.lockedByOther') : t('node.readOnly')} />} />
        <dl className="mt-4 space-y-4 text-xs">
          <div><dt className="text-[10px] uppercase tracking-wider text-slate-400">{t('node.current')}</dt><dd className="mt-1 truncate font-semibold text-slate-800">{currentNode?.name ?? <span role="status" aria-label={t('node.loadingCurrent')}><Skeleton className="h-4 w-32" /></span>}</dd></div>
          <div className="grid grid-cols-2 gap-3"><div><dt className="text-[10px] uppercase tracking-wider text-slate-400">{t('node.childNodes')}</dt><dd className="mt-1 text-lg font-semibold text-slate-800">{controller.isChildrenLoading ? <span role="status" aria-label={t('node.loadingChildCount')}><Skeleton className="h-6 w-8" /></span> : childNodes.length}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-slate-400">{t('node.entities')}</dt><dd className="mt-1 text-lg font-semibold text-slate-800">{controller.isEntitiesLoading ? <span role="status" aria-label={t('node.loadingEntityCount')}><Skeleton className="h-6 w-8" /></span> : nodeEntities.length}</dd></div></div>
          <div className="border-t border-slate-100 pt-3"><dt className="text-[10px] uppercase tracking-wider text-slate-400">{t('node.mode')}</dt><dd className="mt-1 font-medium text-slate-600">{isMyLock ? t('node.editAllowed') : lockedByOther.locked ? t('node.temporarilyLocked') : t('node.readOnly')}</dd></div>
        </dl>
      </Panel>
    </div>
  );
}
