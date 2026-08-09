import type { FormEventHandler } from 'react';
import type { ApiErrorResponse, RuleType } from '@dashboard/core';
import { AdminModalShell } from '../../../../_components/AdminModalShell';

export interface PlacementRuleModalProps {
  formError: ApiErrorResponse | null;
  ruleType: RuleType;
  setRuleType: (value: RuleType) => void;
  targetNodeId: string;
  setTargetNodeId: (value: string) => void;
  targetNodeTypeId: string;
  setTargetNodeTypeId: (value: string) => void;
  comparator: string;
  setComparator: (value: string) => void;
  valueText: string;
  setValueText: (value: string) => void;
  nodes: readonly { id: string; name: string }[];
  nodeTypes: readonly { id: string; name: string }[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function PlacementRuleModal({ formError, ruleType, setRuleType, targetNodeId, setTargetNodeId, targetNodeTypeId, setTargetNodeTypeId, comparator, setComparator, valueText, setValueText, nodes, nodeTypes, isPending, onClose, onSubmit }: PlacementRuleModalProps) {
  return <AdminModalShell><div className="flex items-center justify-between border-b border-slate-800/80 pb-4"><h3 className="text-base font-bold text-slate-100 flex items-center gap-2"><span>➕</span> Nuova Regola Placement</h3><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">✕</button></div>{formError && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{formError.message}</div>}<form onSubmit={onSubmit} className="space-y-4"><div><label className="block text-xs font-medium text-slate-300 mb-1">Tipo Regola *</label><select value={ruleType} onChange={(event) => setRuleType(event.target.value as RuleType)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"><option value="allow_node_type">allow_node_type (Consenti Tipo Nodo)</option><option value="deny_node_type">deny_node_type (Nega Tipo Nodo)</option><option value="allow_node">allow_node (Consenti Nodo Specifico)</option><option value="deny_node">deny_node (Nega Nodo Specifico)</option><option value="allow_subtree">allow_subtree (Consenti Sottoalbero)</option><option value="deny_subtree">deny_subtree (Nega Sottoalbero)</option></select></div><div><label className="block text-xs font-medium text-slate-300 mb-1">Nodo Target (Opzionale)</label><select value={targetNodeId} onChange={(event) => setTargetNodeId(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"><option value="">-- Nessuno --</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.name} ({node.id.substring(0, 8)}...)</option>)}</select></div><div><label className="block text-xs font-medium text-slate-300 mb-1">Tipo Nodo Target (Opzionale)</label><select value={targetNodeTypeId} onChange={(event) => setTargetNodeTypeId(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"><option value="">-- Nessuno --</option>{nodeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-slate-300 mb-1">Comparatore</label><input type="text" placeholder="EQUALS" value={comparator} onChange={(event) => setComparator(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500" /></div><div><label className="block text-xs font-medium text-slate-300 mb-1">Valore Testo</label><input type="text" placeholder="valore" value={valueText} onChange={(event) => setValueText(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500" /></div></div><div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80"><button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50">Annulla</button><button type="submit" disabled={isPending} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50">{isPending ? 'Aggiunta...' : 'Aggiungi Regola'}</button></div></form></AdminModalShell>;
}
