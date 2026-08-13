import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import type { ApiErrorResponse, PlacementPolicyListItemDto, PolicyMode } from '@dashboard/core';
import { AdminModalShell } from '../../../_components/AdminModalShell';
import type { PlacementPolicyForm } from '../_hooks/usePlacementPolicies';

type Props = { editing: PlacementPolicyListItemDto | null; form: PlacementPolicyForm; setForm: Dispatch<SetStateAction<PlacementPolicyForm>>; error: ApiErrorResponse | null; pending: boolean; onClose: () => void; onSubmit: FormEventHandler };
const fieldClass = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500';

export function PlacementPolicyModal({ editing, form, setForm, error, pending, onClose, onSubmit }: Props) {
  const update = <K extends keyof PlacementPolicyForm>(key: K, value: PlacementPolicyForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  return <AdminModalShell>
    <div className="flex items-center justify-between border-b border-slate-800/80 pb-4"><h3 className="text-base font-bold text-slate-100 flex items-center gap-2"><span>{editing ? '✏️' : '➕'}</span> {editing ? 'Modifica Placement Policy' : 'Nuova Placement Policy'}</h3><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-sm">✕</button></div>
    {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error.message}</div>}
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-xs font-medium text-slate-300">Chiave Policy (Snake Case) *<input required disabled={Boolean(editing)} value={form.policyKey} onChange={(event) => update('policyKey', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className={`${fieldClass} mt-1 font-mono disabled:opacity-60`} /></label>
      <label className="block text-xs font-medium text-slate-300">Nome Policy *<input required value={form.name} onChange={(event) => update('name', event.target.value)} className={`${fieldClass} mt-1`} /></label>
      <label className="block text-xs font-medium text-slate-300">Descrizione<textarea rows={2} value={form.description} onChange={(event) => update('description', event.target.value)} className={`${fieldClass} mt-1`} /></label>
      <label className="block text-xs font-medium text-slate-300">Modalità Allocazione *<select value={form.policyMode} onChange={(event) => update('policyMode', event.target.value as PolicyMode)} className={`${fieldClass} mt-1 font-mono`}><option value="allow_all">allow_all (Consenti Tutti i Nodi)</option><option value="deny_all">deny_all (Blocca Tutti i Nodi)</option><option value="node_type_whitelist">node_type_whitelist (Whitelist per Tipo Nodo)</option><option value="node_subtree_whitelist">node_subtree_whitelist (Whitelist per sottoalbero)</option><option value="custom_rule">custom_rule (Regola Custom)</option></select></label>
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80"><button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800/50">Annulla</button><button type="submit" disabled={pending || !form.policyKey || !form.name} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50">{pending ? 'Salvataggio...' : editing ? 'Salva modifiche' : 'Crea policy'}</button></div>
    </form>
  </AdminModalShell>;
}
