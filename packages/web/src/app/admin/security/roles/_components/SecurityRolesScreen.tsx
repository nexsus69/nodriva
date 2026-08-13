'use client';

import { RoleCreateModal } from './RoleCreateModal';
import { RoleListTable } from './RoleListTable';
import { useSecurityRoles } from '../_hooks/useSecurityRoles';

export function SecurityRolesScreen() {
  const controller = useSecurityRoles();
  return <div className="space-y-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5"><span>🛡️</span> Ruoli e Permessi (IAM)</h1><p className="text-xs text-slate-400 mt-1">Definisci i ruoli applicativi e assegna i permessi atomici su nodi ed entità.</p></div><button onClick={controller.openCreate} className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25"><span>➕</span> Nuovo Ruolo</button></div>
    {controller.error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Errore [{controller.error.code}]:</strong> {controller.error.message}</div>}
    <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden"><RoleListTable roles={controller.roles} loading={controller.loading} /></div>
    {controller.isCreateOpen && <RoleCreateModal form={controller.form} setForm={controller.setForm} error={controller.formError} pending={controller.isPending} onClose={() => controller.setCreateOpen(false)} onSubmit={controller.submitCreate} />}
  </div>;
}
