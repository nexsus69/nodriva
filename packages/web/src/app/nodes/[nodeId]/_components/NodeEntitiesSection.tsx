'use client';

/** Renders a node's entities and their creation entry point independently from edit locks. */
import Link from '@/app/components/navigation/GuardedLink';
import { Skeleton, SkeletonState } from '@/app/components/ui/feedback';
import { Panel, SectionHeader } from '../../../components/ui/layout';
import { NodeEntityGrid } from './NodeEntityGrid';
import type { useNodeDetail } from '../_hooks/useNodeDetail';
import { useCreationHref } from '../../../navigation/returnContext';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

interface NodeEntitiesSectionProps { nodeId: string; canCreate: boolean; controller: ReturnType<typeof useNodeDetail> }

export function NodeEntitiesSection({ nodeId, canCreate, controller }: NodeEntitiesSectionProps) {
  const createEntityHref = useCreationHref(`/nodes/${nodeId}/entities/new`);
  const { t } = useAppLocale();
  return (
    <Panel className="space-y-4">
      <SectionHeader
        title={`${t('node.entities')} (${controller.nodeEntities.length})`}
        description={t('node.entitiesDescription')}
        actions={canCreate ? <Link href={createEntityHref} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">+ {t('node.newEntity')}</Link> : undefined}
      />
      {controller.isEntitiesLoading ? <SkeletonState label={t('node.loadingEntities')} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((card) => <div key={card} className="space-y-4 rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /></div></div><Skeleton className="h-3 w-full" /><Skeleton className="h-8 w-24" /></div>)}</SkeletonState>
        : controller.nodeEntities.length === 0 ? <p className="p-6 text-center text-xs text-slate-500">{t('node.noEntities')}</p>
          : <NodeEntityGrid nodeId={nodeId} entities={controller.nodeEntities} entityTypes={controller.entityTypes} entityDefinitions={controller.entityDefinitions} />}
    </Panel>
  );
}
