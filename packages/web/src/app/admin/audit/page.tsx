'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AuditLogListItemDto,
  AuditLogFilterDto,
  PaginatedResultDto,
  ApiErrorResponse,
} from '@dashboard/core';
import { AppCache } from '../../cache/GlobalCacheClient';

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
        {loading || isPending ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Caricamento log di audit in corso...
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="text-3xl block">📜</span>
            <p className="text-sm font-semibold text-slate-300">Nessun evento di audit trovato</p>
            <p className="text-xs text-slate-500">Prova a modificare i criteri di ricerca o i filtri di data.</p>
          </div>
        ) : (
          <>
            <table className="admin-mobile-cards w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase font-mono tracking-wider">
                  <th className="py-3 px-6">Data &amp; Ora</th>
                  <th className="py-3 px-6">Azione</th>
                  <th className="py-3 px-6">Risorsa</th>
                  <th className="py-3 px-6">ID Risorsa</th>
                  <th className="py-3 px-6">Attore</th>
                  <th className="py-3 px-6 text-right">Dettaglio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {data.items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                    <td data-label="Data e ora" className="py-3.5 px-6 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('it-IT')}
                    </td>
                    <td data-label="Azione" className="py-3.5 px-6 font-mono font-bold text-purple-300">
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px]">
                        {log.actionKey}
                      </span>
                    </td>
                    <td data-label="Risorsa" className="py-3.5 px-6 font-mono text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] uppercase">
                        {log.resourceKind}
                      </span>
                    </td>
                    <td data-label="ID risorsa" className="py-3.5 px-6 font-mono text-[11px] text-slate-400">
                      {log.resourceId ? `${log.resourceId.substring(0, 8)}...` : '-'}
                    </td>
                    <td data-label="Attore" className="py-3.5 px-6 font-mono text-[11px] text-slate-300">
                      {log.actorEmail ? (
                        <span>{log.actorEmail}</span>
                      ) : log.actorUserId ? (
                        <span className="text-slate-400">{log.actorUserId.substring(0, 8)}...</span>
                      ) : (
                        <span className="text-slate-500 font-italic">Sistema</span>
                      )}
                    </td>
                    <td data-label="" className="py-3.5 px-6 text-right">
                      <Link
                        href={`/admin/audit/${log.id}`}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                      >
                        🔍 Ispeziona →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Paginazione */}
            <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400 font-mono">
              <div>
                Pagina <strong>{data.page}</strong> di <strong>{data.totalPages || 1}</strong> ({data.total} record totali)
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={data.page <= 1 || isPending}
                  onClick={() => fetchLogs(data.page - 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors"
                >
                  ← Precedente
                </button>
                <button
                  disabled={data.page >= data.totalPages || isPending}
                  onClick={() => fetchLogs(data.page + 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors"
                >
                  Successiva →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
