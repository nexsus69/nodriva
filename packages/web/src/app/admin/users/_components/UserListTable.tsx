import Link from 'next/link';
import type { UserListItemDto } from '@dashboard/core';

export interface UserListTableProps {
  users: readonly UserListItemDto[];
  loading: boolean;
}

export function UserListTable({ users, loading }: UserListTableProps) {
  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Caricamento elenco utenti in corso...</div>;
  if (users.length === 0) return <div className="p-12 text-center space-y-3"><span className="text-3xl block">👤</span><p className="text-sm font-semibold text-slate-300">Nessun utente trovato</p><p className="text-xs text-slate-500">Non ci sono account corrispondenti ai criteri di ricerca.</p></div>;

  return (
    <table className="admin-mobile-cards w-full text-left border-collapse">
      <thead><tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase font-mono tracking-wider"><th className="py-3 px-6">Utente / Email</th><th className="py-3 px-6">Stato Account</th><th className="py-3 px-6">Privilegio</th><th className="py-3 px-6">Ruoli Assegnati</th><th className="py-3 px-6 text-right">Azioni</th></tr></thead>
      <tbody className="divide-y divide-slate-800/60 text-xs">{users.map((user) => <tr key={user.id} className="hover:bg-slate-900/40 transition-colors">
        <td data-label="Utente" className="py-4 px-6 font-medium text-slate-200"><div className="flex items-center gap-3"><div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-indigo-400">{user.email.substring(0, 2).toUpperCase()}</div><span className="font-mono">{user.email}</span></div></td>
        <td data-label="Stato" className="py-4 px-6">{user.isActive ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Attivo</span> : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />Disabilitato</span>}</td>
        <td data-label="Privilegio" className="py-4 px-6">{user.isSuperAdmin ? <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-mono">Super Admin</span> : <span className="text-slate-500 text-[10px] font-mono">Standard</span>}</td>
        <td data-label="Ruoli" className="py-4 px-6"><div className="flex flex-wrap gap-1.5">{user.roles.length > 0 ? user.roles.map((role) => <span key={role.id} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono">{role.name}</span>) : <span className="text-slate-600 text-[10px]">Nessun ruolo</span>}</div></td>
        <td data-label="" className="py-4 px-6 text-right"><Link href={`/admin/users/${user.id}`} className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors inline-block">Dettaglio &rarr;</Link></td>
      </tr>)}</tbody>
    </table>
  );
}
