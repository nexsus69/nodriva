import type { ApiErrorResponse, SystemSettingDto } from '@dashboard/core';
import type { FormEventHandler } from 'react';
import { AdminModalShell } from '../../../_components/AdminModalShell';
import { AdminResourceLock } from '../../../_components/AdminResourceLock';

type Props = { setting: SystemSettingDto; value: string; error: ApiErrorResponse | null; pending: boolean; onValueChange: (value: string) => void; onClose: () => void; onSubmit: FormEventHandler };

export function SystemSettingModal({ setting, value, error, pending, onValueChange, onClose, onSubmit }: Props) {
  return <AdminModalShell>
    <AdminResourceLock resourceType="system_setting" resourceId={setting.settingKey} />
    <div className="flex items-center justify-between border-b border-slate-800/80 pb-4"><h3 className="text-base font-bold text-slate-100"><span>✏️</span> Modifica Valore Setting</h3><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button></div>
    {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error.message}</div>}
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-xs font-medium text-slate-400">Chiave Setting<input disabled value={setting.settingKey} className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono" /></label>
      <label className="block text-xs font-medium text-slate-300">Valore ({setting.valueType.toUpperCase()}) *<textarea required rows={3} value={value} onChange={(event) => onValueChange(event.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500" /></label>
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80"><button type="button" onClick={onClose} className="px-4 py-2 text-xs text-slate-400">Annulla</button><button type="submit" disabled={pending} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white disabled:opacity-50">{pending ? 'Salvataggio...' : 'Salva Valore'}</button></div>
    </form>
  </AdminModalShell>;
}
