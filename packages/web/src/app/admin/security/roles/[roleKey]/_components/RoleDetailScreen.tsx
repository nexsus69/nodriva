'use client';

import Link from 'next/link';
import { AdminResourceLock } from '../../../../_components/AdminResourceLock';
import { RolePermissionsMatrix } from './RolePermissionsMatrix';
import { useRoleDetail } from '../_hooks/useRoleDetail';

export function RoleDetailScreen({ roleKey }: { roleKey: string }) {
  const controller = useRoleDetail(roleKey);
  if (controller.loading) return <div className="p-8 text-center text-xs text-slate-400">Caricamento dettaglio ruolo in corso...</div>;
  if (!controller.role) return <div className="space-y-4"><BackLink /><div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Impossibile caricare il ruolo</strong><p>{controller.error?.message ?? 'Ruolo non trovato.'}</p></div></div>;
  const role = controller.role;
  return <div className="space-y-6">
    <AdminResourceLock resourceType="role" resourceId={role.id} />
    <div><BackLink /><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-xl font-bold text-slate-100"><span>🛡️</span> Ruolo: {role.name}</h1><p className="text-xs font-mono text-purple-400">{role.roleKey}</p></div>{role.isSystem && <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">🔒 Ruolo di Sistema</span>}</div></div>
    {controller.successMessage && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">{controller.successMessage}</div>}
    {controller.error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Errore [{controller.error.code}]:</strong> {controller.error.message}</div>}
    <form onSubmit={controller.savePermissions}><div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6"><div className="flex items-center justify-between border-b border-slate-800/80 pb-4"><div><h2 className="text-sm font-bold text-slate-200">Matrice Permessi Atomici</h2><p className="text-xs text-slate-400">Seleziona le capabilities attribuite dal ruolo.</p></div>{!role.isSystem && <button type="submit" disabled={controller.isPending} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white disabled:opacity-50">{controller.isPending ? 'Salvataggio...' : 'Salva Permessi'}</button>}</div><RolePermissionsMatrix groupedPermissions={controller.groupedPermissions} isSystem={role.isSystem} selectedPermissionIds={controller.selectedPermissionIds} onToggle={controller.togglePermission} /></div></form>
  </div>;
}

function BackLink() { return <Link href="/admin/security/roles" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mb-2">&larr; Torna alla lista ruoli</Link>; }
