import { NodeTree } from '../../../components/navigation/NodeTree';
import { Skeleton } from '../../../components/ui/feedback';
import { Panel, SectionHeader } from '../../../components/ui/layout';
import type { useNodeDetail } from '../_hooks/useNodeDetail';

interface NodeContextOverviewProps { nodeId: string; controller: ReturnType<typeof useNodeDetail> }

export function NodeContextOverview({ nodeId, controller }: NodeContextOverviewProps) {
  const { currentNode, childNodes, nodeEntities, isMyLock, lockedByOther } = controller;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <NodeTree activeNodeId={nodeId} activeNodePath={currentNode?.path} />
      <Panel as="aside">
        <SectionHeader title="Riepilogo nodo" description="Contesto" actions={<span className={`h-2.5 w-2.5 rounded-full ${isMyLock ? 'bg-emerald-500' : lockedByOther.locked ? 'bg-amber-500' : 'bg-slate-300'}`} title={isMyLock ? 'Modifica attiva' : lockedByOther.locked ? 'Bloccato da altro utente' : 'Sola lettura'} />} />
        <dl className="mt-4 space-y-4 text-xs">
          <div><dt className="text-[10px] uppercase tracking-wider text-slate-400">Nodo corrente</dt><dd className="mt-1 truncate font-semibold text-slate-800">{currentNode?.name ?? <span role="status" aria-label="Caricamento nodo corrente"><Skeleton className="h-4 w-32" /></span>}</dd></div>
          <div className="grid grid-cols-2 gap-3"><div><dt className="text-[10px] uppercase tracking-wider text-slate-400">Sotto-nodi</dt><dd className="mt-1 text-lg font-semibold text-slate-800">{controller.isChildrenLoading ? <span role="status" aria-label="Caricamento numero sotto-nodi"><Skeleton className="h-6 w-8" /></span> : childNodes.length}</dd></div><div><dt className="text-[10px] uppercase tracking-wider text-slate-400">Entità</dt><dd className="mt-1 text-lg font-semibold text-slate-800">{controller.isEntitiesLoading ? <span role="status" aria-label="Caricamento numero entità"><Skeleton className="h-6 w-8" /></span> : nodeEntities.length}</dd></div></div>
          <div className="border-t border-slate-100 pt-3"><dt className="text-[10px] uppercase tracking-wider text-slate-400">Modalità</dt><dd className="mt-1 font-medium text-slate-600">{isMyLock ? 'Modifica autorizzata' : lockedByOther.locked ? 'Bloccato temporaneamente' : 'Sola lettura'}</dd></div>
        </dl>
      </Panel>
    </div>
  );
}
