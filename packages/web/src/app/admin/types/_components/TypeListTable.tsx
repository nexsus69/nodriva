import Link from '@/app/components/navigation/GuardedLink';
import type { TypeKind, TypeListItemDto } from '@dashboard/core';

export interface TypeListTableProps {
  kind: TypeKind;
  types: readonly TypeListItemDto[];
  loading: boolean;
}

export function TypeListTable({ kind, types, loading }: TypeListTableProps) {
  if (loading) {
    return <div className="p-12 text-center text-slate-400 space-y-3"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm">Caricamento tipi in corso...</p></div>;
  }
  if (types.length === 0) {
    return <div className="p-12 text-center text-slate-400 space-y-2"><p className="text-lg font-medium text-slate-300">Nessun tipo configurato per {kind}</p><p className="text-sm">Crea il tuo primo tipo per iniziare ad amministrare i dati.</p></div>;
  }

  return (
    <table className="admin-mobile-cards w-full text-left border-collapse text-sm">
      <thead><tr className="border-b border-slate-800/80 bg-slate-900/80 text-slate-400 font-medium">
        <th className="py-3.5 px-5">Nome / Tipo</th><th className="py-3.5 px-5">Type Key</th>{kind === 'entity' && <th className="py-3.5 px-5">Storage Table</th>}<th className="py-3.5 px-5">Schema Ver.</th><th className="py-3.5 px-5">Row Ver.</th><th className="py-3.5 px-5">Campi</th><th className="py-3.5 px-5">Stato</th><th className="py-3.5 px-5 text-right">Azione</th>
      </tr></thead>
      <tbody className="divide-y divide-slate-800/50">
        {types.map((type) => (
          <tr key={type.id} className="hover:bg-slate-800/30 transition-colors group">
            <td data-label="Tipo" className="py-4 px-5"><div className="font-semibold text-slate-100 flex items-center gap-2">{type.name}{type.isSystem && <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">SYSTEM</span>}</div>{type.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{type.description}</p>}</td>
            <td data-label="Chiave" className="py-4 px-5 font-mono text-xs text-indigo-300">{type.typeKey}</td>
            {kind === 'entity' && <td data-label="Tabella" className="py-4 px-5 font-mono text-xs text-slate-400">{type.storageTable ?? 'N/A'}</td>}
            <td data-label="Schema" className="py-4 px-5 text-slate-300 font-mono">v{type.currentSchemaVersion}</td>
            <td data-label="Versione" className="py-4 px-5 text-slate-400 font-mono">r{type.rowVersion}</td>
            <td data-label="Campi" className="py-4 px-5"><span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-medium rounded-full">{type.fieldCount} campi</span></td>
            <td data-label="Stato" className="py-4 px-5">{type.isActive ? <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium"><span className="w-2 h-2 rounded-full bg-emerald-500" />Attivo</span> : <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium"><span className="w-2 h-2 rounded-full bg-rose-500" />Disabilitato</span>}</td>
            <td data-label="" className="py-4 px-5 text-right"><Link href={`/admin/types/${kind}/${type.typeKey}`} className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg transition-all">Dettaglio &amp; Campi →</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
