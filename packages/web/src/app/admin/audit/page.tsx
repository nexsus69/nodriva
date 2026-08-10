'use client';

import React, { useEffect, useState, useTransition } from 'react';
import type {
  AuditLogListItemDto,
  AuditLogFilterDto,
  PaginatedResultDto,
  ApiErrorResponse,
} from '@dashboard/core';
import { AppCache } from '../../cache/GlobalCacheClient';
import { AuditLogTable } from './_components/AuditLogTable';

export default function AuditLogsPage() {
  const [data, setData] = useState<PaginatedResultDto<AuditLogListItemDto> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  // Filtri di ricerca
  const [actionKey, setActionKey] = useState<string>('');
  const [resourceKind, setResourceKind] = useState<string>('');
  const [actorUserId, setActorUserId] = useState<string>('');
  const [resourceId, setResourceId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  const fetchLogs = (targetPage: number = 1) => {
    setLoading(true);
    setError(null);

    const filters: AuditLogFilterDto = {
      page: targetPage,
      pageSize: 20,
      actionKey: actionKey || undefined,
      resourceKind: resourceKind || undefined,
      actorUserId: actorUserId || undefined,
      resourceId: resourceId || undefined,
      fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
      toDate: toDate ? new Date(toDate).toISOString() : undefined,
    };

    startTransition(async () => {
      const res = await AppCache.admin.listAuditLogs(filters);
      if (res.success && res.data) {
        setData(res.data);
      } else if (res.error) {
        setError(res.error);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      AppCache.admin.listAuditLogs({ page: 1, pageSize: 20 }).then((res) => {
        if (res.success && res.data) setData(res.data);
        else if (res.error) setError(res.error);
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleReset = () => {
    setActionKey('');
    setResourceKind('');
    setActorUserId('');
    setResourceId('');
    setFromDate('');
    setToDate('');
    setLoading(true);
    setError(null);
    startTransition(async () => {
      const res = await AppCache.admin.listAuditLogs({ page: 1, pageSize: 20 });
      if (res.success && res.data) {
        setData(res.data);
      } else if (res.error) {
        setError(res.error);
      }
      setLoading(false);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
          <span>📜</span> Audit Trail (Registro Log di Sistema)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Registro di sola lettura per consultare tutte le operazioni amministrative ed evoluzioni di sistema.
        </p>
      </div>

      {/* Pannello Filtri */}
      <form onSubmit={handleSearch} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Azione (action_key)</label>
            <input
              type="text"
              placeholder="es. user.create"
              value={actionKey}
              onChange={(e) => setActionKey(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Tipo Risorsa</label>
            <select
              value={resourceKind}
              onChange={(e) => setResourceKind(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            >
              <option value="">-- Tutti --</option>
              <option value="user">user</option>
              <option value="role">role</option>
              <option value="permission">permission</option>
              <option value="node">node</option>
              <option value="entity">entity</option>
              <option value="node_type">node_type</option>
              <option value="entity_type">entity_type</option>
              <option value="runtime_capability">runtime_capability</option>
              <option value="system_setting">system_setting</option>
              <option value="placement_policy">placement_policy</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">ID Risorsa (UUID)</label>
            <input
              type="text"
              placeholder="es. 00000000-..."
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">ID Attore (UUID)</label>
            <input
              type="text"
              placeholder="es. 00000000-..."
              value={actorUserId}
              onChange={(e) => setActorUserId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Da Data</label>
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">A Data</label>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            Reset Filtri
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
          >
            <span>🔍</span> Applica Filtri
          </button>
        </div>
      </form>

      {/* Errore */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore [{error.code}]:</span> {error.message}
        </div>
      )}

      {/* Tabella Audit Logs */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <AuditLogTable data={data} loading={loading} isPending={isPending} onPageChange={fetchLogs} />
      </div>
    </div>
  );
}
