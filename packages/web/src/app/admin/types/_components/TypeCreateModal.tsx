import type { ApiErrorResponse, TypeKind } from '@dashboard/core';
import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import { AdminModalShell } from '../../_components/AdminModalShell';
import type { TypeCreateForm } from '../_hooks/useAdminTypes';

type Props = {
  kind: TypeKind;
  form: TypeCreateForm;
  setForm: Dispatch<SetStateAction<TypeCreateForm>>;
  error: ApiErrorResponse | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler;
};

const inputClass = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500';

export function TypeCreateModal({ kind, form, setForm, error, pending, onClose, onSubmit }: Props) {
  const update = (field: keyof TypeCreateForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  return (
    <AdminModalShell className="max-w-lg bg-slate-900 border-slate-700/80 animate-in fade-in zoom-in duration-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-xl font-bold text-white">Crea Nuovo {kind === 'node' ? 'Nodo' : 'Entità'}</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
      </div>
      {error && <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-red-300 text-xs">⚠️ {error.message}</div>}
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Type Key *
          <input required placeholder="es. customer_info" value={form.typeKey} onChange={(event) => update('typeKey', event.target.value)} className={`${inputClass} mt-1 font-mono`} />
          <span className="block text-[11px] normal-case font-normal text-slate-400 mt-1">Minuscole, numeri e underscore. Immutabile dopo la creazione.</span>
        </label>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Nome *
          <input required placeholder="es. Info Cliente" value={form.name} onChange={(event) => update('name', event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Descrizione
          <textarea rows={2} value={form.description} onChange={(event) => update('description', event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        {kind === 'entity' && <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Storage Table (Fisica) *
          <input required placeholder="es. entity_customer_info" value={form.storageTable} onChange={(event) => update('storageTable', event.target.value)} className={`${inputClass} mt-1 font-mono`} />
        </label>}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg">Annulla</button>
          <button type="submit" disabled={pending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-md disabled:opacity-50">{pending ? 'Creazione...' : 'Crea Tipo'}</button>
        </div>
      </form>
    </AdminModalShell>
  );
}
