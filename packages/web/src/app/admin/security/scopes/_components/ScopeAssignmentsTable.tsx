import type { ScopeAssignmentDto } from '@dashboard/core';

export interface ScopeAssignmentsTableProps {
  scopes: readonly ScopeAssignmentDto[];
  loading: boolean;
  isPending: boolean;
  onEdit: (scope: ScopeAssignmentDto) => void;
  onDelete: (scopeId: string) => void;
}

export function ScopeAssignmentsTable({ scopes, loading, isPending, onEdit, onDelete }: ScopeAssignmentsTableProps) {
  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Caricamento assegnazioni scope in corso...</div>;
  if (scopes.length === 0) return <div className="p-12 text-center space-y-3"><span className="text-3xl block">🔒</span><p className="text-sm font-semibold text-slate-300">Nessuna assegnazione scope trovata</p><p className="text-xs text-slate-500">Gli utenti senza scope dedicato ereditano i permessi di default.</p></div>;

  return (
    <table className="admin-mobile-cards w-full text-left border-collapse">
      <thead><tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase font-mono tracking-wider"><th className="py-3 px-6">Utente</th><th className="py-3 px-6">Nodo Destinazione</th><th className="py-3 px-6">Ruolo Assegnato</th><th className="py-3 px-6">Effetto</th><th className="py-3 px-6">Propagazione</th><th className="py-3 px-6 text-right">Azioni</th></tr></thead>
      <tbody className="divide-y divide-slate-800/60 text-xs">{scopes.map((scope) => <tr key={scope.id} className="hover:bg-slate-900/40 transition-colors">
        <td data-label="Utente" className="py-4 px-6 font-medium text-slate-200 font-mono">{scope.userEmail}</td><td data-label="Nodo" className="py-4 px-6 font-semibold text-slate-100">{scope.nodeName}</td>
        <td data-label="Ruolo" className="py-4 px-6">{scope.roleName ? <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono text-[10px]">{scope.roleName}</span> : <span className="text-slate-500 text-[10px]">Qualsiasi</span>}</td>
        <td data-label="Effetto" className="py-4 px-6">{scope.assignmentEffect === 'allow' ? <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">ALLOW</span> : <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[10px]">DENY</span>}</td>
        <td data-label="Propagazione" className="py-4 px-6 font-mono text-slate-400 text-[10px]">{scope.propagation === 'subtree' ? 'Subtree (Ricorsivo)' : 'Self (Solo Nodo)'}</td>
        <td data-label="" className="py-4 px-6 text-right space-x-2"><button type="button" onClick={() => onEdit(scope)} disabled={isPending} className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors">✏️ Modifica</button><button type="button" onClick={() => onDelete(scope.id)} disabled={isPending} className="px-3 py-1 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors">Rimuovi</button></td>
      </tr>)}</tbody>
    </table>
  );
}
