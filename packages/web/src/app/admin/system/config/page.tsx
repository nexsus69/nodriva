'use client';

import React, { useEffect, useState, useTransition } from 'react';
import type {
  RuntimeCapabilityDto,
  SystemSettingDto,
  CapabilityStatus,
  ApiErrorResponse,
} from '@dashboard/core';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { AdminModalShell } from '../../_components/AdminModalShell';
import { SystemSettingsTable } from './_components/SystemSettingsTable';
import { RuntimeCapabilitiesGrid } from './_components/RuntimeCapabilitiesGrid';

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
      AppCache.admin.listCapabilities(),
      AppCache.admin.listSettings(),
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
      const res = await AppCache.admin.updateCapabilityStatus({
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
      const res = await AppCache.admin.updateSetting({
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
          <RuntimeCapabilitiesGrid capabilities={capabilities} loading={loading} isPending={isPending} onStatusChange={handleStatusChange} />
        </div>
      </div>

      {/* Sezione 2: Impostazioni di Sistema (System Settings) */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
          <span>🎛️</span> Impostazioni Globali (System Settings)
        </h2>

        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <SystemSettingsTable settings={settings} loading={loading} isPending={isPending} onEdit={handleOpenEditSetting} />
        </div>
      </div>

      {/* Modale Modifica System Setting */}
      {editingSetting && (
        <AdminModalShell>
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
        </AdminModalShell>
      )}
    </div>
  );
}
