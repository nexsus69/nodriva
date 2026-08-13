'use client';

import { AdminModalShell } from '../../_components/AdminModalShell';
import { UserCreateForm } from './UserCreateForm';
import { UserListTable } from './UserListTable';
import { useUserAdminList } from '../_hooks/useUserAdminList';

const filterClass = (selected: boolean, selectedColor: string) => `px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
  selected ? `${selectedColor} text-white font-semibold shadow-sm` : 'text-slate-400 hover:text-slate-200'
}`;

export function UserAdminScreen() {
  const controller = useUserAdminList();
  const activeCount = controller.users.filter((user) => user.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5"><span>👥</span> Gestione Utenti</h1>
          <p className="text-xs text-slate-400 mt-1">Visualizza gli account attivi, registra nuovi utenti e gestisci le assegnazioni di ruolo.</p>
        </div>
        <button onClick={controller.openCreate} className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 self-start md:self-auto">
          <span>➕</span> Registra nuovo utente
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl glass-panel border border-slate-800">
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800/80 w-full sm:w-auto">
          <button onClick={() => controller.setFilterStatus('all')} className={filterClass(controller.filterStatus === 'all', 'bg-indigo-600')}>Tutti ({controller.users.length})</button>
          <button onClick={() => controller.setFilterStatus('active')} className={filterClass(controller.filterStatus === 'active', 'bg-emerald-600')}>Attivi ({activeCount})</button>
          <button onClick={() => controller.setFilterStatus('disabled')} className={filterClass(controller.filterStatus === 'disabled', 'bg-rose-600')}>Disabilitati ({controller.users.length - activeCount})</button>
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Cerca per email</span>
          <input type="search" placeholder="Cerca per email..." value={controller.searchTerm} onChange={(event) => controller.setSearchTerm(event.target.value)} className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
          <span className="absolute left-3 top-2 text-slate-500 text-xs">🔍</span>
        </label>
      </div>

      {controller.error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><span className="font-bold">Errore [{controller.error.code}]:</span> {controller.error.message}</div>}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden"><UserListTable users={controller.filteredUsers} loading={controller.loading} /></div>

      {controller.isCreateOpen && (
        <AdminModalShell>
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2"><span>👤</span> Registra nuovo utente</h3>
            <button type="button" onClick={controller.closeCreate} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
          </div>
          <UserCreateForm
            values={controller.form}
            scopes={controller.delegableScopes}
            selectedScopeIds={controller.selectedScopeIds}
            formError={controller.formError}
            isPending={controller.isPending}
            onChange={(name, value) => controller.setForm((current) => ({ ...current, [name]: value }))}
            onScopeToggle={(scopeId, checked) => controller.setSelectedScopeIds((current) => checked ? [...current, scopeId] : current.filter((id) => id !== scopeId))}
            onSubmit={controller.submitCreate}
          />
        </AdminModalShell>
      )}
    </div>
  );
}
