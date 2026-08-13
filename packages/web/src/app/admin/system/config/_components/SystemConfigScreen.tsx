'use client';

import { RuntimeCapabilitiesGrid } from './RuntimeCapabilitiesGrid';
import { SystemSettingModal } from './SystemSettingModal';
import { SystemSettingsTable } from './SystemSettingsTable';
import { useSystemConfig } from '../_hooks/useSystemConfig';

export function SystemConfigScreen() {
  const controller = useSystemConfig();
  return <div className="space-y-8">
    <div><h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5"><span>⚙️</span> Capacità Runtime & Impostazioni di Sistema</h1><p className="text-xs text-slate-400 mt-1">Governa i moduli applicativi e configura le variabili di sistema globali.</p></div>
    {controller.error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Errore [{controller.error.code}]:</strong> {controller.error.message}</div>}
    <section className="space-y-4"><h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider"><span>⚡</span> Runtime Capabilities</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><RuntimeCapabilitiesGrid capabilities={controller.capabilities} loading={controller.loading} isPending={controller.isPending} onStatusChange={controller.updateCapability} /></div></section>
    <section className="space-y-4"><h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider"><span>🎛️</span> Impostazioni Globali</h2><div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden"><SystemSettingsTable settings={controller.settings} loading={controller.loading} isPending={controller.isPending} onEdit={controller.openSetting} /></div></section>
    {controller.editingSetting && <SystemSettingModal setting={controller.editingSetting} value={controller.settingValue} error={controller.formError} pending={controller.isPending} onValueChange={controller.setSettingValue} onClose={() => controller.setEditingSetting(null)} onSubmit={controller.saveSetting} />}
  </div>;
}
