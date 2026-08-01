'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuditLogDetailDto, ApiErrorResponse } from '@dashboard/core';
import { getAuditLogByIdAction } from '../../../actions/auditActions';

export default function AuditLogDetailPage() {
  const params = useParams();
  const auditId = params.auditId as string;

  const [log, setLog] = useState<AuditLogDetailDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  useEffect(() => {
    if (!auditId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      const res = await getAuditLogByIdAction(auditId);
      if (res.success && res.data) {
        setLog(res.data);
      } else if (res.error) {
        setError(res.error);
      } else if (res.success && !res.data) {
        setError({ message: 'Evento di audit non trovato.', code: 'AUDIT_LOG_NOT_FOUND' });
      }
      setLoading(false);
    };

    loadData();
  }, [auditId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        Caricamento dettaglio evento di audit in corso...
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/audit"
          className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono"
        >
          ← Torna all&apos;Elenco Audit Logs
        </Link>
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore:</span> {error?.message || 'Evento di audit non trovato.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/admin/audit"
        className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono"
      >
        ← Torna all&apos;Elenco Audit Logs
      </Link>

      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono font-bold text-xs">
              {log.actionKey}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase border border-slate-700">
              {log.resourceKind}
            </span>
          </div>
          <span className="font-mono text-xs text-slate-400">
            {new Date(log.createdAt).toLocaleString('it-IT')}
          </span>
        </div>

        <h1 className="text-xl font-bold text-slate-100 font-mono">ID Evento: {log.id}</h1>
      </div>

      {/* Grid Metadati Evento */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase">ID Risorsa Target</span>
          <p className="text-xs font-mono font-bold text-slate-200 truncate">{log.resourceId}</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Attore Operazione</span>
          <p className="text-xs font-mono font-bold text-slate-200 truncate">
            {log.actorEmail || log.actorUserId || 'Sistema'}
          </p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase">ID Nodo Appartenenza</span>
          <p className="text-xs font-mono font-bold text-slate-200 truncate">{log.nodeId || '-'}</p>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Timestamp ISO</span>
          <p className="text-xs font-mono font-bold text-slate-200 truncate">{log.createdAt}</p>
        </div>
      </div>

      {/* Payload Comparison Side-by-Side */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
          <span>🔍</span> Confronto Payload Staging (Prima / Dopo)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Before Payload */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 font-semibold">
              <span>Stato Precedente (before_payload)</span>
              {log.beforePayload === null && <span className="text-slate-500 font-normal">Null / Non Presente</span>}
            </div>
            <div className="p-4 bg-slate-950/60 flex-1 overflow-x-auto">
              <pre className="text-xs font-mono text-rose-300/90 whitespace-pre-wrap leading-relaxed">
                {log.beforePayload !== null ? JSON.stringify(log.beforePayload, null, 2) : 'null'}
              </pre>
            </div>
          </div>

          {/* After Payload */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 font-semibold">
              <span>Stato Successivo (after_payload)</span>
              {log.afterPayload === null && <span className="text-slate-500 font-normal">Null / Non Presente</span>}
            </div>
            <div className="p-4 bg-slate-950/60 flex-1 overflow-x-auto">
              <pre className="text-xs font-mono text-emerald-300/90 whitespace-pre-wrap leading-relaxed">
                {log.afterPayload !== null ? JSON.stringify(log.afterPayload, null, 2) : 'null'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
