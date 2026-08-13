import Link from '@/app/components/navigation/GuardedLink';
import type { AuditLogDetailDto, ApiErrorResponse } from '@dashboard/core';

export function AuditLogDetail({ log, loading, error }: { log: AuditLogDetailDto | null; loading: boolean; error: ApiErrorResponse | null }) {
  if (loading) return <div className="p-12 text-center text-xs text-slate-400">Caricamento dettaglio evento di audit in corso...</div>;
  if (!log) return <div className="space-y-4"><BackLink /><div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Errore:</strong> {error?.message || 'Evento di audit non trovato.'}</div></div>;
  return <div className="space-y-6">
    <BackLink />
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4"><div className="flex items-center justify-between flex-wrap gap-2"><div className="flex items-center gap-2"><span className="px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono font-bold text-xs">{log.actionKey}</span><span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase border border-slate-700">{log.resourceKind}</span></div><span className="font-mono text-xs text-slate-400">{new Date(log.createdAt).toLocaleString('it-IT')}</span></div><h1 className="text-xl font-bold text-slate-100 font-mono">ID Evento: {log.id}</h1></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><Metadata label="ID Risorsa Target" value={log.resourceId} /><Metadata label="Attore Operazione" value={log.actorEmail || log.actorUserId || 'Sistema'} /><Metadata label="ID Nodo Appartenenza" value={log.nodeId || '-'} /><Metadata label="Timestamp ISO" value={log.createdAt} /></div>
    <section className="space-y-3"><h2 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider"><span>🔍</span> Confronto Payload Staging (Prima / Dopo)</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Payload title="Stato Precedente" value={log.beforePayload} color="text-rose-300/90" /><Payload title="Stato Successivo" value={log.afterPayload} color="text-emerald-300/90" /></div></section>
  </div>;
}

function BackLink() { return <Link href="/admin/audit" className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-mono">← Torna all&apos;Elenco Audit Logs</Link>; }
function Metadata({ label, value }: { label: string; value: string }) { return <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1"><span className="text-[10px] font-mono text-slate-400 uppercase">{label}</span><p className="text-xs font-mono font-bold text-slate-200 truncate">{value}</p></div>; }
function Payload({ title, value, color }: { title: string; value: unknown; color: string }) { return <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col"><div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs font-mono text-slate-400 font-semibold">{title}</div><div className="p-4 bg-slate-950/60 flex-1 overflow-x-auto"><pre className={`text-xs font-mono whitespace-pre-wrap leading-relaxed ${color}`}>{value === null ? 'null' : JSON.stringify(value, null, 2)}</pre></div></div>; }
