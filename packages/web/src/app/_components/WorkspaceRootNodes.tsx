import Link from '@/app/components/navigation/GuardedLink';
import { EmptyState, Skeleton, SkeletonState } from '../components/ui/feedback';
import { Panel, SectionHeader } from '../components/ui/layout';
import { NodeResourceMenu } from '../components/ui/menu';

type RootNode = { id: string; name: string; description?: string | null };

export function WorkspaceRootNodes({ nodes, loading }: { nodes: readonly RootNode[]; loading: boolean }) {
  return <section className="space-y-4"><SectionHeader title="Nodi radice" description="Navigazione" actions={<span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">{nodes.length} disponibili</span>} />
    {loading ? <RootNodeCardsSkeleton /> : nodes.length === 0 ? <EmptyState title="Nessun nodo radice trovato" description="Inizializza il database o crea un primo nodo dall'amministrazione." /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{nodes.map((node) => <article key={node.id} className="group glass-panel flex flex-col justify-between space-y-6 rounded-2xl border border-slate-200 p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-200"><div className="space-y-3"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-xl text-indigo-500">⌂</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-mono text-slate-500">Nodo radice</span></div><div><h3 className="flex min-w-0 items-center gap-1 text-base font-semibold text-slate-800"><span className="truncate">{node.name}</span><NodeResourceMenu nodeId={node.id} nodeName={node.name} /></h3><p className="text-xs text-slate-400 mt-1 line-clamp-2">{node.description || 'Nessuna descrizione specificata.'}</p></div></div><div className="flex items-center justify-between border-t border-slate-200 pt-4"><span className="text-xs text-slate-500 font-mono">ID: {node.id.substring(0, 8)}...</span><Link href={`/nodes/${node.id}`} className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white">Apri nodo →</Link></div></article>)}</div>}
  </section>;
}

function RootNodeCardsSkeleton() {
  return <SkeletonState label="Caricamento struttura gerarchica" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((card) => <Panel key={card} className="space-y-6"><div className="space-y-4"><div className="flex justify-between"><Skeleton className="h-11 w-11 rounded-xl" /><Skeleton className="h-5 w-20 rounded-full" /></div><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /></div><div className="flex items-center justify-between border-t border-slate-200 pt-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-24 rounded-xl" /></div></Panel>)}</SkeletonState>;
}
