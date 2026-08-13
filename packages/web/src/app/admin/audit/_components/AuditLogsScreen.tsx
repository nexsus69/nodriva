'use client';

import { AuditFilters } from './AuditFilters';
import { AuditLogTable } from './AuditLogTable';
import { useAuditLogs } from '../_hooks/useAuditLogs';

export function AuditLogsScreen() {
  const controller = useAuditLogs();
  return <div className="space-y-6">
    <div><h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5"><span>📜</span> Audit Trail (Registro Log di Sistema)</h1><p className="text-xs text-slate-400 mt-1">Registro di sola lettura delle operazioni amministrative e delle evoluzioni di sistema.</p></div>
    <AuditFilters filters={controller.filters} setFilters={controller.setFilters} pending={controller.isPending} onSubmit={controller.search} onReset={controller.reset} />
    {controller.error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Errore [{controller.error.code}]:</strong> {controller.error.message}</div>}
    <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden"><AuditLogTable data={controller.data} loading={controller.loading} isPending={controller.isPending} onPageChange={controller.fetchLogs} /></div>
  </div>;
}
