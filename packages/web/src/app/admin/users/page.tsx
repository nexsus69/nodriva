'use client';

import React, { useEffect, useState, useTransition } from 'react';
import type {
  UserListItemDto,
  CreateUserUiCommand,
  ScopeAssignmentDto,
  ApiErrorResponse,
} from '@dashboard/core';
import { AppCache } from '../../cache/GlobalCacheClient';
import { AdminModalShell } from '../_components/AdminModalShell';
import { UserListTable } from './_components/UserListTable';
import { UserCreateForm } from './_components/UserCreateForm';

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
  const [delegableScopes, setDelegableScopes] = useState<ScopeAssignmentDto[]>([]);
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>([]);
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

    startTransition(async () => {
      try {
        const assignments = delegableScopes
          .filter((scope) => selectedScopeIds.includes(scope.id) && scope.assignmentEffect === 'allow')
          .map((scope) => ({ nodeId: scope.nodeId, roleId: scope.roleId, propagation: scope.propagation }));
        if (assignments.length > 0) {
          await AppCache.users.createScopedUser({ email: newEmail.trim(), password: newPassword, assignments });
        } else {
          const cmd: CreateUserUiCommand = { email: newEmail.trim(), password: newPassword, isSuperAdmin: newIsSuperAdmin };
          await AppCache.users.createUser(cmd);
        }
        setShowCreateModal(false);
        setNewEmail('');
        setNewPassword('');
          setNewIsSuperAdmin(false);
        setSelectedScopeIds([]);
        await loadUsers();
      } catch (err) {
        setFormError(err as ApiErrorResponse);
      }
    });
  };

  const handleCreateFormChange = (name: string, value: unknown) => {
    if (name === 'email' && typeof value === 'string') setNewEmail(value);
    if (name === 'password' && typeof value === 'string') setNewPassword(value);
    if (name === 'isSuperAdmin' && typeof value === 'boolean') setNewIsSuperAdmin(value);
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
            setSelectedScopeIds([]);
            AppCache.admin.listScopeAssignments().then((result) => {
              if (result.success && result.data) setDelegableScopes(result.data.filter((scope) => scope.assignmentEffect === 'allow'));
            }).catch(() => setDelegableScopes([]));
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
        <UserListTable users={filteredUsers} loading={loading} />
      </div>

      {/* Modal di Creazione Utente */}
      {showCreateModal && (
        <AdminModalShell>
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2"><span>👤</span> Registra Nuovo Utente</h3>
            <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
          </div>
          <UserCreateForm values={{ email: newEmail, password: newPassword, isSuperAdmin: newIsSuperAdmin }} scopes={delegableScopes} selectedScopeIds={selectedScopeIds} formError={formError} isPending={isPending} onChange={handleCreateFormChange} onScopeToggle={(scopeId, checked) => setSelectedScopeIds((current) => checked ? [...current, scopeId] : current.filter((id) => id !== scopeId))} onSubmit={handleCreateUser} />
        </AdminModalShell>
      )}
    </div>
  );
}
