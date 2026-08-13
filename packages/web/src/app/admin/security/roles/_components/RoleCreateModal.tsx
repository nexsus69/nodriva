import type { ApiErrorResponse } from '@dashboard/core';
import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import { AdminModalShell } from '../../../_components/AdminModalShell';
import type { RoleCreateForm } from '../_hooks/useSecurityRoles';

type Props = { form: RoleCreateForm; setForm: Dispatch<SetStateAction<RoleCreateForm>>; error: ApiErrorResponse | null; pending: boolean; onClose: () => void; onSubmit: FormEventHandler };
const fieldClass = 'w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500';

export function RoleCreateModal({ form, setForm, error, pending, onClose, onSubmit }: Props) {
  const update = (key: keyof RoleCreateForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <AdminModalShell>
    <div className="flex items-center justify-between border-b border-slate-800/80 pb-4"><h3 className="text-base font-bold text-slate-100"><span>🛡️</span> Nuovo Ruolo Applicativo</h3><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button></div>
    {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error.message}</div>}
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-xs font-medium text-slate-300">Chiave Ruolo (snake_case) *<input required value={form.roleKey} onChange={(event) => update('roleKey', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className={`${fieldClass} font-mono`} /></label>
      <label className="block text-xs font-medium text-slate-300">Nome Ruolo *<input required value={form.name} onChange={(event) => update('name', event.target.value)} className={fieldClass} /></label>
      <label className="block text-xs font-medium text-slate-300">Descrizione<textarea rows={2} value={form.description} onChange={(event) => update('description', event.target.value)} className={fieldClass} /></label>
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80"><button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-400">Annulla</button><button type="submit" disabled={pending || !form.roleKey.trim() || !form.name.trim()} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white disabled:opacity-50">{pending ? 'Creazione...' : 'Crea Ruolo'}</button></div>
    </form>
  </AdminModalShell>;
}
