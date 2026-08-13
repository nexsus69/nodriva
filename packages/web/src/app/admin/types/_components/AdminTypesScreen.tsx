'use client';

import { TypeCreateModal } from './TypeCreateModal';
import { TypeListTable } from './TypeListTable';
import { useAdminTypes } from '../_hooks/useAdminTypes';

export function AdminTypesScreen() {
  const controller = useAdminTypes();
  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div><h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2"><span>⚙️</span> Admin Dashboard — Tipi Modello</h1><p className="text-slate-400 text-sm mt-1">Gestione amministrativa dei nodi e delle entità dinamiche della piattaforma.</p></div>
        <button onClick={controller.openCreate} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"><span>+</span> Crea Nuovo {controller.kind === 'node' ? 'Nodo' : 'Entità'}</button>
      </div>
      <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 w-fit">
        {(['node', 'entity'] as const).map((kind) => <button key={kind} onClick={() => controller.setKind(kind)} className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${controller.kind === kind ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>{kind === 'node' ? '🌲 Node Types (Gerarchici)' : '📦 Entity Types (Dati Dinamici)'}</button>)}
      </div>
      {controller.error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between gap-4"><span><strong>Errore [{controller.error.code}]:</strong> {controller.error.message}</span>{controller.error.code !== 'ACCESS_FORBIDDEN' && <button onClick={() => void controller.loadTypes()} className="shrink-0 px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20">Ricarica</button>}</div>}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl"><TypeListTable kind={controller.kind} types={controller.types} loading={controller.loading} /></div>
      {controller.isCreateOpen && <TypeCreateModal kind={controller.kind} form={controller.form} setForm={controller.setForm} error={controller.formError} pending={controller.isPending} onClose={controller.closeCreate} onSubmit={controller.submitCreate} />}
    </div>
  );
}
