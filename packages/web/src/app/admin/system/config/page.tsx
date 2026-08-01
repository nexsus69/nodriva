'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  RuntimeCapabilityDto,
  SystemSettingDto,
  CapabilityStatus,
  ApiErrorResponse,
} from '@dashboard/core';
import {
  listCapabilitiesAction,
  updateCapabilityStatusAction,
  listSettingsAction,
  updateSettingAction,
} from '../../../actions/systemActions';

export default function SystemConfigPage() {
  const [capabilities, setCapabilities] = useState<RuntimeCapabilityDto[]>([]);
  const [settings, setSettings] = useState<SystemSettingDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  const [editingSetting, setEditingSetting] = useState<SystemSettingDto | null>(null);
  const [settingValue, setSettingValue] = useState<string>('');
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);

  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [resCap, resSet] = await Promise.all([
      listCapabilitiesAction(),
      listSettingsAction(),
    ]);

    if (resCap.success && resCap.data) setCapabilities(resCap.data);
    if (resSet.success && resSet.data) setSettings(resSet.data);
    if (!resCap.success && resCap.error) setError(resCap.error);
    if (!resSet.success && resSet.error) setError(resSet.error);

    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleStatusChange = (capabilityKey: string, newStatus: CapabilityStatus) => {
    startTransition(async () => {
      const res = await updateCapabilityStatusAction({
        capabilityKey,
        status: newStatus,
      });
      if (res.success) {
        await loadData();
      } else if (res.error) {
        setError(res.error);
      }
    });
  };

  const handleOpenEditSetting = (s: SystemSettingDto) => {
    setEditingSetting(s);
    setSettingValue(s.valueText ?? '');
    setFormError(null);
  };

  const handleSaveSetting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSetting) return;
    setFormError(null);

    startTransition(async () => {
      const res = await updateSettingAction({
        settingKey: editingSetting.settingKey,
        settingValueText: settingValue,
        expectedRowVersion: editingSetting.rowVersion,
      });

      if (res.success) {
        setEditingSetting(null);
        await loadData();
      } else if (res.error) {
        setFormError(res.error);
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
          <span>⚙️</span> Capacità Runtime & Impostazioni di Sistema
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Governa lo stato di funzionamento a runtime dei moduli applicativi e configura le variabili di sistema globali.
        </p>
      </div>

      {/* Errore Generale */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore [{error.code}]:</span> {error.message}
        </div>
      )}

      {/* Sezione 1: Runtime Capabilities */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
          <span>⚡</span> Runtime Capabilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 glass-panel p-6 text-center text-xs text-slate-400">
              Caricamento capabilities in corso...
            </div>
          ) : capabilities.length === 0 ? (
            <div className="col-span-3 glass-panel p-6 text-center text-xs text-slate-500">
              Nessuna capability registrata.
            </div>
          ) : (
            capabilities.map((c) => (
              <div
                key={c.id}
                className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono font-semibold text-xs text-purple-300">
                      {c.capabilityKey}
                    </span>
                    {c.isSystem && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        SYSTEM
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">{c.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{c.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">Stato Attivo:</span>
                  <select
                    disabled={isPending}
                    value={c.currentStatus}
                    onChange={(e) => handleStatusChange(c.capabilityKey, e.target.value as CapabilityStatus)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="enabled">ENABLED (Abilitato)</option>
                    <option value="disabled">DISABLED (Disabilitato)</option>
                    <option value="optional">OPTIONAL (Opzionale)</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sezione 2: Impostazioni di Sistema (System Settings) */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
          <span>🎛️</span> Impostazioni Globali (System Settings)
        </h2>

        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Caricamento impostazioni in corso...
            </div>
          ) : settings.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <span className="text-3xl block">⚙️</span>
              <p className="text-sm font-semibold text-slate-300">Nessuna impostazione trovata</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase font-mono tracking-wider">
                  <th className="py-3 px-6">Categoria</th>
                  <th className="py-3 px-6">Chiave Setting</th>
                  <th className="py-3 px-6">Nome / Descrizione</th>
                  <th className="py-3 px-6">Tipo Valore</th>
                  <th className="py-3 px-6">Valore Attuale</th>
                  <th className="py-3 px-6 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {settings.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-4 px-6 font-mono text-purple-400 text-[11px]">
                      {s.category}
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-slate-200">
                      {s.settingKey}
                    </td>
                    <td className="py-4 px-6 max-w-xs">
                      <div className="font-semibold text-slate-100">{s.displayName}</div>
                      <div className="text-[11px] text-slate-400 truncate">{s.description}</div>
                    </td>
                    <td className="py-4 px-6 font-mono text-[10px] text-slate-400">
                      {s.valueType.toUpperCase()}
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-200 max-w-xs truncate">
                      {s.isSecret ? '••••••••' : s.valueText ?? '<Nullo>'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleOpenEditSetting(s)}
                        disabled={isPending}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                      >
                        ✏️ Modifica
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modale Modifica System Setting */}
      {editingSetting && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>✏️</span> Modifica Valore Setting
              </h3>
              <button
                onClick={() => setEditingSetting(null)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {formError.message}
              </div>
            )}

            <form onSubmit={handleSaveSetting} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Chiave Setting</label>
                <input
                  disabled
                  value={editingSetting.settingKey}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Valore ({editingSetting.valueType.toUpperCase()}) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={settingValue}
                  onChange={(e) => setSettingValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setEditingSetting(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {isPending ? 'Salvataggio...' : 'Salva Valore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
