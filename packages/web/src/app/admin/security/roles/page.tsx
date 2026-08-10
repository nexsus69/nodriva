'use client';

import React, { useEffect, useState, useTransition } from 'react';
import type { RoleListItemDto, CreateRoleUiCommand, ApiErrorResponse } from '@dashboard/core';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { AdminModalShell } from '../../_components/AdminModalShell';
import { RoleListTable } from './_components/RoleListTable';

export default function SecurityRolesListPage() {
  const [roles, setRoles] = useState<RoleListItemDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const [roleKey, setRoleKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);

  const loadRoles = async () => {
    setLoading(true);
    setError(null);
    const res = await AppCache.admin.listRoles();
    if (res.success && res.data) {
      setRoles(res.data);
    } else if (res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(loadRoles, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cmd: CreateRoleUiCommand = {
      roleKey: roleKey.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
    };

    startTransition(async () => {
      const res = await AppCache.admin.createRole(cmd);
      if (res.success && res.data) {
        setShowCreateModal(false);
        setRoleKey('');
        setName('');
        setDescription('');
        await loadRoles();
      } else if (res.error) {
        setFormError(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <span>🛡️</span> Ruoli e Permessi (IAM)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Definisci i ruoli applicativi di sistema ed assegna la matrice di permessi atomici su nodi ed entità.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setShowCreateModal(true);
          }}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <span>➕</span> Nuovo Ruolo
        </button>
      </div>

      {/* Errore Generale */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore [{error.code}]:</span> {error.message}
        </div>
      )}

      {/* Tabella Ruoli */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <RoleListTable roles={roles} loading={loading} />
      </div>

      {/* Modal Creazione Ruolo */}
      {showCreateModal && (
        <AdminModalShell>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>🛡️</span> Nuovo Ruolo Applicativo
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {formError.message}
              </div>
            )}

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Chiave Ruolo (snake_case) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. node_operator"
                  value={roleKey}
                  onChange={(e) => setRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome Ruolo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. Operatore Nodi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Descrizione (Opzionale)
                </label>
                <textarea
                  rows={2}
                  placeholder="Descrivi l'ambito operativo del ruolo"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending || !roleKey.trim() || !name.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {isPending ? 'Creazione...' : 'Crea Ruolo'}
                </button>
              </div>
            </form>
        </AdminModalShell>
      )}
    </div>
  );
}
