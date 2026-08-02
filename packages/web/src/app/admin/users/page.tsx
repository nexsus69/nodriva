'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  UserListItemDto,
  CreateUserUiCommand,
  ApiErrorResponse,
} from '@dashboard/core';
import { AppCache } from '../../cache/GlobalCacheClient';

export default function UserAdminListPage() {
  const [users, setUsers] = useState<UserListItemDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // Form di creazione utente
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsSuperAdmin, setNewIsSuperAdmin] = useState(false);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await AppCache.users.listUsers());
    } catch (err) {
      setError(err as ApiErrorResponse);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    AppCache.users.listUsers().then((data) => {
      if (cancelled) return;
      setUsers(data);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err as ApiErrorResponse);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cmd: CreateUserUiCommand = {
      email: newEmail.trim(),
      password: newPassword,
      isSuperAdmin: newIsSuperAdmin,
    };

    startTransition(async () => {
      try {
        await AppCache.users.createUser(cmd);
        setShowCreateModal(false);
        setNewEmail('');
        setNewPassword('');
        setNewIsSuperAdmin(false);
        await loadUsers();
      } catch (err) {
        setFormError(err as ApiErrorResponse);
      }
    });
  };

  const filteredUsers = users.filter((u) => {
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? u.isActive
        : !u.isActive;
    const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Titolo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <span>👥</span> Gestione Utenti
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visualizza gli account attivi, registra nuovi utenti e gestisci le assegnazioni di ruolo.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setShowCreateModal(true);
          }}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <span>➕</span> Registra Nuovo Utente
        </button>
      </div>

      {/* Bar dei Filtri e Ricerca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl glass-panel border border-slate-800">
        {/* Tab Filtro Stato */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800/80 w-full sm:w-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterStatus === 'all'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tutti ({users.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterStatus === 'active'
                ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Attivi ({users.filter((u) => u.isActive).length})
          </button>
          <button
            onClick={() => setFilterStatus('disabled')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterStatus === 'disabled'
                ? 'bg-rose-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Disabilitati ({users.filter((u) => !u.isActive).length})
          </button>
        </div>

        {/* Input di Ricerca Email */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Cerca per email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <span className="absolute left-3 top-2 text-slate-500 text-xs">🔍</span>
        </div>
      </div>

      {/* Errore Generale */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore [{error.code}]:</span> {error.message}
        </div>
      )}

      {/* Tabella Utenti */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Caricamento elenco utenti in corso...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="text-3xl block">👤</span>
            <p className="text-sm font-semibold text-slate-300">Nessun utente trovato</p>
            <p className="text-xs text-slate-500">Non ci sono account corrispondenti ai criteri di ricerca.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase font-mono tracking-wider">
                <th className="py-3 px-6">Utente / Email</th>
                <th className="py-3 px-6">Stato Account</th>
                <th className="py-3 px-6">Privilegio</th>
                <th className="py-3 px-6">Ruoli Assegnati</th>
                <th className="py-3 px-6 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-4 px-6 font-medium text-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-indigo-400">
                        {u.email.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-mono">{u.email}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Attivo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Disabilitato
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {u.isSuperAdmin ? (
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-mono">
                        Super Admin
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px] font-mono">Standard</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.length > 0 ? (
                        u.roles.map((r) => (
                          <span
                            key={r.id}
                            className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono"
                          >
                            {r.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-600 text-[10px]">Nessun ruolo</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors inline-block"
                    >
                      Dettaglio &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal di Creazione Utente */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>👤</span> Registra Nuovo Utente
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

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Utente *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="utente@mate.com"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password Iniziale *
                </label>
                <input
                  type="password"
                  required
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="12+ caratteri, maiuscola, minuscola, numero e simbolo"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isSuperAdmin"
                  checked={newIsSuperAdmin}
                  onChange={(e) => setNewIsSuperAdmin(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isSuperAdmin" className="text-xs text-slate-300 font-medium">
                  Assegna Privilegio Super Admin
                </label>
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
                  disabled={isPending || !newEmail.trim() || newPassword.length < 12}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? 'Creazione in corso...' : 'Crea Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
