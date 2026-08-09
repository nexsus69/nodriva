import Link from 'next/link';
import type { RoleListItemDto } from '@dashboard/core';

export interface RoleListTableProps {
  roles: readonly RoleListItemDto[];
  loading: boolean;
}

export function RoleListTable({ roles, loading }: RoleListTableProps) {
  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Caricamento elenco ruoli in corso...</div>;
  if (roles.length === 0) return <div className="p-12 text-center space-y-3"><span className="text-3xl block">🛡️</span><p className="text-sm font-semibold text-slate-300">Nessun ruolo trovato</p><p className="text-xs text-slate-500">Non ci sono ruoli configurati nel sistema.</p></div>;

  return (
    <table className="admin-mobile-cards w-full text-left border-collapse">
      <thead><tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase font-mono tracking-wider"><th className="py-3 px-6">Nome Ruolo</th><th className="py-3 px-6">Chiave Identificativa</th><th className="py-3 px-6">Permessi Associati</th><th className="py-3 px-6">Origine</th><th className="py-3 px-6 text-right">Azioni</th></tr></thead>
      <tbody className="divide-y divide-slate-800/60 text-xs">{roles.map((role) => <tr key={role.id} className="hover:bg-slate-900/40 transition-colors">
        <td data-label="Ruolo" className="py-4 px-6 font-medium text-slate-200"><div className="space-y-0.5"><span className="font-bold text-slate-100">{role.name}</span>{role.description && <p className="text-[11px] text-slate-400 font-normal">{role.description}</p>}</div></td>
        <td data-label="Chiave" className="py-4 px-6 font-mono text-purple-400">{role.roleKey}</td>
        <td data-label="Permessi" className="py-4 px-6"><span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono text-[10px]">{role.permissionCount} permessi</span></td>
        <td data-label="Origine" className="py-4 px-6">{role.isSystem ? <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-mono">Sistema</span> : <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-mono">Personalizzato</span>}</td>
        <td data-label="" className="py-4 px-6 text-right"><Link href={`/admin/security/roles/${role.roleKey}`} className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors inline-block">Permessi &rarr;</Link></td>
      </tr>)}</tbody>
    </table>
  );
}
