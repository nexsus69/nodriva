import type { FormEventHandler } from 'react';
import type { TypeDetailDto } from '@dashboard/core';

interface TypeDetailOverviewProps {
  detail: TypeDetailDto;
  name: string;
  description: string;
  isPending: boolean;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function TypeDetailOverview({ detail, name, description, isPending, setName, setDescription, onSubmit }: TypeDetailOverviewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
        <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
          <span>Proprietà del Tipo</span>
          <span className="text-xs font-mono text-slate-400 font-normal">Schema: v{detail.currentSchemaVersion} | RowVersion: r{detail.rowVersion}</span>
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="type-detail-name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Nome Tipo *</label>
            <input id="type-detail-name" name="name" type="text" required disabled={!detail.isEditable} value={name} onChange={(event) => setName(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" />
          </div>
          <div>
            <label htmlFor="type-detail-description" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Descrizione</label>
            <textarea id="type-detail-description" name="description" rows={3} disabled={!detail.isEditable} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" />
          </div>
          {detail.isEditable && (
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={isPending} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50">{isPending ? 'Salvataggio...' : 'Salva modifiche al tipo'}</button>
            </div>
          )}
        </form>
      </div>

      <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 text-xs">
        <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">Informazioni Tecniche</h3>
        <dl className="space-y-2.5">
          <div><dt className="text-slate-400 block">Identificatore UUID:</dt><dd className="font-mono text-slate-200">{detail.id}</dd></div>
          <div><dt className="text-slate-400 block">Dominio:</dt><dd className="font-semibold text-indigo-300 capitalize">{detail.kind}</dd></div>
          {detail.storageTable && <div><dt className="text-slate-400 block">Tabella Fisica Storage:</dt><dd className="font-mono text-slate-200">{detail.storageTable}</dd></div>}
          <div><dt className="text-slate-400 block">Istanze Attive nel DB:</dt><dd className="font-bold text-slate-200">{detail.instanceCount} elementi</dd></div>
          <div><dt className="text-slate-400 block">Data Creazione:</dt><dd className="text-slate-300">{new Date(detail.createdAt).toLocaleString()}</dd></div>
          <div><dt className="text-slate-400 block">Ultimo Aggiornamento:</dt><dd className="text-slate-300">{new Date(detail.updatedAt).toLocaleString()}</dd></div>
        </dl>
      </div>
    </div>
  );
}
