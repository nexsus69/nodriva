import Link from 'next/link';
import type { AuditLogListItemDto, PaginatedResultDto, TypeDetailDto } from '@dashboard/core';
import { AppCache } from '../../../../../cache/GlobalCacheClient';

type SchemaImpact = Awaited<ReturnType<typeof AppCache.admin.getTypeSchemaImpact>>['data'];

interface TypeSchemaGovernanceProps {
  detail: TypeDetailDto;
  schemaHistory: PaginatedResultDto<AuditLogListItemDto> | null;
  schemaImpact: SchemaImpact;
  onPrepareRollback: (auditId: string) => void;
}

export function TypeSchemaGovernance({ detail, schemaHistory, schemaImpact, onPrepareRollback }: TypeSchemaGovernanceProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div><h2 className="text-lg font-bold text-white">Impatto schema</h2><p className="text-xs text-slate-400 mt-1">Anteprima informativa prima delle modifiche strutturali.</p></div>
          <span className="font-mono text-xs text-indigo-300">v{schemaImpact?.currentSchemaVersion ?? detail.currentSchemaVersion} → v{schemaImpact?.nextSchemaVersion ?? detail.currentSchemaVersion + 1}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-slate-950/70 p-3"><span className="text-slate-400 block">Campi attuali</span><span className="text-white font-semibold">{schemaImpact?.fieldCount ?? detail.fields.length}</span></div>
          <div className="rounded-lg bg-slate-950/70 p-3"><span className="text-slate-400 block">Istanze attive</span><span className="text-white font-semibold">{schemaImpact?.instanceCount ?? detail.instanceCount}</span></div>
        </div>
        {schemaImpact?.warnings.length
          ? <div className="space-y-2 text-xs text-amber-200">{schemaImpact.warnings.map((warning) => <p key={warning} className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3">⚠ {warning}</p>)}</div>
          : <p className="text-xs text-emerald-300">Nessuna avvertenza rilevata per il tipo corrente.</p>}
      </section>

      <section className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="border-b border-slate-800 pb-3"><h2 className="text-lg font-bold text-white">Storico schema</h2><p className="text-xs text-slate-400 mt-1">Le modifiche sono recuperate dall’audit trail immutabile.</p></div>
        {!schemaHistory?.items.length ? <p className="text-xs text-slate-500">Nessuna modifica registrata.</p> : (
          <div className="max-h-64 overflow-auto space-y-2">
            {schemaHistory.items.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 hover:border-indigo-500/50 transition-colors">
                <div className="flex items-center justify-between gap-3"><Link href={`/admin/audit/${entry.id}`} className="text-xs font-semibold text-indigo-300 hover:underline">{entry.actionKey}</Link><span className="text-[11px] text-slate-500">{new Date(entry.createdAt).toLocaleString()}</span></div>
                <div className="flex items-center justify-between gap-3 mt-1"><span className="text-[11px] text-slate-400">{entry.actorEmail ?? entry.actorUserId ?? 'Sistema'} · versione collegata al tipo</span>{entry.actionKey === 'type_admin.update_type' && <button type="button" onClick={() => onPrepareRollback(entry.id)} className="text-[11px] text-amber-300 hover:text-amber-200">Valuta ripristino</button>}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
