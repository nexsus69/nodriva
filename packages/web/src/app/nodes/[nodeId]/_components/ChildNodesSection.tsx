import Link from 'next/link';
import { NodeResourceMenu } from '../../../components/ui/menu';
import type { ClientNode } from '../../../types/models';

interface ChildNodesSectionProps { nodeId: string; childNodes: readonly ClientNode[]; readOnly: boolean }

export function ChildNodesSection({ nodeId, childNodes, readOnly }: ChildNodesSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700 font-mono"><span>🌿</span> Sotto-Nodi Gerarchici ({childNodes.length})</h2>
        {!readOnly && <Link href={`/nodes/${nodeId}/new`} className="text-xs text-indigo-400 font-semibold hover:underline">+ Aggiungi Sotto-Nodo</Link>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {childNodes.length === 0 ? <div className="col-span-3 glass-panel p-6 text-center text-xs text-slate-500 rounded-2xl">Nessun sotto-nodo figlio presente.</div> : childNodes.map((childNode) => (
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
