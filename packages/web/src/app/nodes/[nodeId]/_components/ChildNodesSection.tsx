'use client';

/** Renders child-node navigation without coupling creation availability to edit locks. */
import Link from '@/app/components/navigation/GuardedLink';
import { Skeleton, SkeletonState } from '../../../components/ui/feedback';
import { NodeResourceMenu } from '../../../components/ui/menu';
import type { ClientNode } from '../../../types/models';
import { useCreationHref } from '../../../navigation/returnContext';

interface ChildNodesSectionProps { nodeId: string; childNodes: readonly ClientNode[]; loading: boolean; canCreate: boolean }

export function ChildNodesSection({ nodeId, childNodes, loading, canCreate }: ChildNodesSectionProps) {
  const createChildHref = useCreationHref(`/nodes/${nodeId}/new`);
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700 font-mono"><span>🌿</span> Sotto-Nodi Gerarchici ({childNodes.length})</h2>
        {canCreate && <Link href={createChildHref} className="text-xs text-indigo-400 font-semibold hover:underline">+ Aggiungi Sotto-Nodo</Link>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? <SkeletonState label="Caricamento sotto-nodi" className="col-span-3 grid grid-cols-1 gap-4 md:grid-cols-3">{[0, 1, 2].map((card) => <div key={card} className="space-y-3 rounded-xl border border-slate-200 p-4"><div className="flex justify-between"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-4" /></div><Skeleton className="h-3 w-4/5" /></div>)}</SkeletonState> : childNodes.length === 0 ? <div className="col-span-3 glass-panel p-6 text-center text-xs text-slate-500 rounded-2xl">Nessun sotto-nodo figlio presente.</div> : childNodes.map((childNode) => (
          <div key={childNode.id} className="glass-panel group rounded-xl border border-slate-200 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1"><Link href={`/nodes/${childNode.id}`} className="min-w-0 truncate text-xs font-semibold text-slate-700 group-hover:text-indigo-600">{childNode.name || childNode.id}</Link><NodeResourceMenu nodeId={childNode.id} nodeName={childNode.name || childNode.id} /></div>
              <Link href={`/nodes/${childNode.id}`} className="shrink-0 text-slate-500 group-hover:text-indigo-400 font-mono text-xs">→</Link>
            </div>
            <Link href={`/nodes/${childNode.id}`} className="block"><p className="mt-1 truncate text-[11px] text-slate-400">{childNode.description || 'Nessuna descrizione.'}</p></Link>
          </div>
        ))}
      </div>
    </section>
  );
}
