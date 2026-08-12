import type { SystemSettingDto } from '@dashboard/core';

export interface SystemSettingsTableProps {
  settings: readonly SystemSettingDto[];
  loading: boolean;
  isPending: boolean;
  onEdit: (setting: SystemSettingDto) => void;
}

export function SystemSettingsTable({ settings, loading, isPending, onEdit }: SystemSettingsTableProps) {
  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Caricamento impostazioni in corso...</div>;
  if (settings.length === 0) return <div className="p-12 text-center space-y-3"><span className="text-3xl block">⚙️</span><p className="text-sm font-semibold text-slate-300">Nessuna impostazione trovata</p></div>;

  return <table className="admin-mobile-cards w-full text-left border-collapse"><thead><tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase font-mono tracking-wider"><th className="py-3 px-6">Categoria</th><th className="py-3 px-6">Chiave Setting</th><th className="py-3 px-6">Nome / Descrizione</th><th className="py-3 px-6">Tipo Valore</th><th className="py-3 px-6">Valore Attuale</th><th className="py-3 px-6 text-right">Azioni</th></tr></thead><tbody className="divide-y divide-slate-800/60 text-xs">{settings.map((setting) => <tr key={setting.id} className="hover:bg-slate-900/40 transition-colors"><td data-label="Categoria" className="py-4 px-6 font-mono text-purple-400 text-[11px]">{setting.category}</td><td data-label="Chiave" className="py-4 px-6 font-mono font-bold text-slate-200">{setting.settingKey}</td><td data-label="Nome" className="py-4 px-6 max-w-xs"><div className="font-semibold text-slate-100">{setting.displayName}</div><div className="text-[11px] text-slate-400 break-words">{setting.description}</div></td><td data-label="Tipo" className="py-4 px-6 font-mono text-[10px] text-slate-400">{setting.valueType.toUpperCase()}</td><td data-label="Valore" className="py-4 px-6 font-mono text-slate-200 max-w-xs break-words">{setting.isSecret ? '••••••••' : setting.valueText ?? '<Nullo>'}</td><td data-label="" className="py-4 px-6 text-right"><button type="button" onClick={() => onEdit(setting)} disabled={isPending} className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors">✏️ Modifica</button></td></tr>)}</tbody></table>;
}
