import type { PlacementPolicyDetailDto } from '@dashboard/core';

interface PlacementPolicyHeaderProps {
  policy: PlacementPolicyDetailDto;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddRule: () => void;
}

export function PlacementPolicyHeader({ policy, isPending, onEdit, onDelete, onAddRule }: PlacementPolicyHeaderProps) {
  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs font-bold text-purple-300">{policy.policyKey}</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase border border-slate-700">{policy.policyMode}</span>
        </div>
        <h1 className="text-xl font-bold text-slate-100">{policy.name}</h1>
        <p className="text-xs text-slate-400 mt-1">{policy.description || 'Nessuna descrizione.'}</p>
      </div>
      <div className="flex items-center gap-2 self-start md:self-auto">
        <button type="button" onClick={onEdit} className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5"><span>✏️</span> Modifica Policy</button>
        <button type="button" onClick={onDelete} disabled={isPending} className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all flex items-center gap-1.5"><span>🗑️</span> Elimina</button>
        <button type="button" onClick={onAddRule} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 transition-all flex items-center gap-2"><span>➕</span> Aggiungi Regola</button>
      </div>
    </div>
  );
}
