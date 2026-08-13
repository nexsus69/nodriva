import Link from '@/app/components/navigation/GuardedLink';
import type { PlacementPolicyListItemDto } from '@dashboard/core';

export interface PlacementPolicyGridProps {
  policies: readonly PlacementPolicyListItemDto[];
  loading: boolean;
  isPending: boolean;
  onEdit: (policy: PlacementPolicyListItemDto) => void;
  onDelete: (policy: PlacementPolicyListItemDto) => void;
}

export function PlacementPolicyGrid({ policies, loading, isPending, onEdit, onDelete }: PlacementPolicyGridProps) {
  if (loading) return <div className="col-span-2 glass-panel p-8 text-center text-xs text-slate-400">Caricamento placement policies in corso...</div>;
  if (policies.length === 0) return <div className="col-span-2 glass-panel p-12 text-center space-y-3"><span className="text-3xl block">🗺️</span><p className="text-sm font-semibold text-slate-300">Nessuna Placement Policy trovata</p><p className="text-xs text-slate-500">Crea una nuova policy per regolare l&apos;allocazione delle entità.</p></div>;

  return <>{policies.map((policy) => <div key={policy.id} className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all">
    <div><div className="flex items-center justify-between gap-2 mb-2"><span className="font-mono text-xs font-bold text-purple-300">{policy.policyKey}</span><span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase border border-slate-700">{policy.policyMode}</span></div><h3 className="text-base font-bold text-slate-100">{policy.name}</h3><p className="text-xs text-slate-400 mt-1">{policy.description || 'Nessuna descrizione specificata.'}</p></div>
    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between"><span className="text-xs text-slate-400 font-mono">Regole attive: <strong className="text-slate-200">{policy.ruleCount}</strong></span><div className="flex items-center gap-2"><button type="button" onClick={() => onEdit(policy)} disabled={isPending} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors">✏️ Modifica</button><button type="button" onClick={() => onDelete(policy)} disabled={isPending} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors">🗑️</button><Link href={`/admin/system/placement-policies/${policy.policyKey}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors">⚙️ Regole →</Link></div></div>
  </div>)}</>;
}
