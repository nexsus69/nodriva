import type { FormEventHandler } from 'react';
import type { ApiErrorResponse, PolicyMode } from '@dashboard/core';
import { AdminModalShell } from '../../../../_components/AdminModalShell';

interface PlacementPolicyEditModalProps {
  policyKey: string;
  name: string;
  description: string;
  policyMode: PolicyMode;
  formError: ApiErrorResponse | null;
  isPending: boolean;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  setPolicyMode: (value: PolicyMode) => void;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function PlacementPolicyEditModal({
  policyKey,
  name,
  description,
  policyMode,
  formError,
  isPending,
  setName,
  setDescription,
  setPolicyMode,
  onClose,
  onSubmit,
}: PlacementPolicyEditModalProps) {
  return (
    <AdminModalShell>
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2"><span>✏️</span> Modifica Placement Policy</h3>
        <button type="button" onClick={onClose} aria-label="Chiudi modifica policy" className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
      </div>
      {formError && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{formError.message}</div>}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="edit-policy-key" className="block text-xs font-medium text-slate-400 mb-1">Chiave Policy</label>
          <input id="edit-policy-key" name="policyKey" disabled value={policyKey} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono" />
        </div>
        <div>
          <label htmlFor="edit-policy-name" className="block text-xs font-medium text-slate-300 mb-1">Nome Policy *</label>
          <input id="edit-policy-name" name="name" required type="text" value={name} onChange={(event) => setName(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500" />
        </div>
        <div>
          <label htmlFor="edit-policy-description" className="block text-xs font-medium text-slate-300 mb-1">Descrizione</label>
          <textarea id="edit-policy-description" name="description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500" />
        </div>
        <div>
          <label htmlFor="edit-policy-mode" className="block text-xs font-medium text-slate-300 mb-1">Modalità Allocazione *</label>
          <select id="edit-policy-mode" name="policyMode" value={policyMode} onChange={(event) => setPolicyMode(event.target.value as PolicyMode)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono">
            <option value="allow_all">allow_all (Consenti Tutti i Nodi)</option>
            <option value="deny_all">deny_all (Blocca Tutti i Nodi)</option>
            <option value="node_type_whitelist">node_type_whitelist (Whitelist per Tipo Nodo)</option>
            <option value="node_subtree_whitelist">node_subtree_whitelist (whitelist per sottoalbero)</option>
            <option value="custom_rule">custom_rule (Regola Custom)</option>
          </select>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50">Annulla</button>
          <button type="submit" disabled={isPending || !name} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50">{isPending ? 'Salvataggio...' : 'Salva modifiche'}</button>
        </div>
      </form>
    </AdminModalShell>
  );
}
