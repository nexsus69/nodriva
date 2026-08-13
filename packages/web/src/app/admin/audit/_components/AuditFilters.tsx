import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import type { AuditFilterForm } from '../_hooks/useAuditLogs';

type Props = { filters: AuditFilterForm; setFilters: Dispatch<SetStateAction<AuditFilterForm>>; pending: boolean; onSubmit: FormEventHandler; onReset: () => void };
const fieldClass = 'w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500';

export function AuditFilters({ filters, setFilters, pending, onSubmit, onReset }: Props) {
  const update = (key: keyof AuditFilterForm, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  return <form onSubmit={onSubmit} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <FilterField label="Azione (action_key)"><input placeholder="es. user.create" value={filters.actionKey} onChange={(event) => update('actionKey', event.target.value)} className={fieldClass} /></FilterField>
      <FilterField label="Tipo Risorsa"><select value={filters.resourceKind} onChange={(event) => update('resourceKind', event.target.value)} className={fieldClass}><option value="">-- Tutti --</option>{['user', 'role', 'permission', 'node', 'entity', 'node_type', 'entity_type', 'runtime_capability', 'system_setting', 'placement_policy'].map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></FilterField>
      <FilterField label="ID Risorsa (UUID)"><input value={filters.resourceId} onChange={(event) => update('resourceId', event.target.value)} className={fieldClass} /></FilterField>
      <FilterField label="ID Attore (UUID)"><input value={filters.actorUserId} onChange={(event) => update('actorUserId', event.target.value)} className={fieldClass} /></FilterField>
      <FilterField label="Da Data"><input type="datetime-local" value={filters.fromDate} onChange={(event) => update('fromDate', event.target.value)} className={fieldClass} /></FilterField>
      <FilterField label="A Data"><input type="datetime-local" value={filters.toDate} onChange={(event) => update('toDate', event.target.value)} className={fieldClass} /></FilterField>
    </div>
    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60"><button type="button" onClick={onReset} disabled={pending} className="px-3 py-1.5 text-xs text-slate-400">Reset Filtri</button><button type="submit" disabled={pending} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white disabled:opacity-50"><span>🔍</span> Applica Filtri</button></div>
  </form>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-slate-400">{label}<span className="block mt-1">{children}</span></label>;
}
