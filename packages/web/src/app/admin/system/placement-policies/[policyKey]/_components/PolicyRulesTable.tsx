import type { PlacementPolicyDetailDto } from '@dashboard/core';

export interface PolicyRulesTableProps {
  rules: readonly PlacementPolicyDetailDto['rules'][number][];
  isPending: boolean;
  onDelete: (ruleId: string) => void;
}

export function PolicyRulesTable({ rules, isPending, onDelete }: PolicyRulesTableProps) {
  if (rules.length === 0) return <div className="p-12 text-center space-y-3"><span className="text-3xl block">🧩</span><p className="text-sm font-semibold text-slate-300">Nessuna regola definita per questa policy</p><p className="text-xs text-slate-500">Le entità senza regola usano la configurazione di default.</p></div>;
  return <table className="w-full text-left border-collapse"><thead><tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase font-mono tracking-wider"><th className="py-3 px-6">Tipo Regola</th><th className="py-3 px-6">Nodo Target</th><th className="py-3 px-6">Tipo Nodo Target</th><th className="py-3 px-6">Comparatore</th><th className="py-3 px-6">Valore Testo</th><th className="py-3 px-6 text-right">Azioni</th></tr></thead><tbody className="divide-y divide-slate-800/60 text-xs">{rules.map((rule) => <tr key={rule.id} className="hover:bg-slate-900/40 transition-colors"><td className="py-4 px-6 font-mono font-bold text-purple-300">{rule.ruleType}</td><td className="py-4 px-6 font-medium text-slate-200">{rule.targetNodeName || <span className="text-slate-500 font-mono text-[10px]">-</span>}</td><td className="py-4 px-6 font-medium text-slate-200">{rule.targetNodeTypeName || <span className="text-slate-500 font-mono text-[10px]">-</span>}</td><td className="py-4 px-6 font-mono text-[10px] text-slate-400">{rule.comparator || '-'}</td><td className="py-4 px-6 font-mono text-slate-200 max-w-xs truncate">{rule.valueText || '-'}</td><td className="py-4 px-6 text-right"><button type="button" onClick={() => onDelete(rule.id)} disabled={isPending} className="px-3 py-1 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors">Elimina</button></td></tr>)}</tbody></table>;
}
