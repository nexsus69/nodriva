'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  ScopeAssignmentDto,
  UserListItemDto,
  RoleListItemDto,
  CreateScopeAssignmentUiCommand,
  UpdateScopeAssignmentUiCommand,
  ApiErrorResponse,
} from '@dashboard/core';
import { AppCache } from '../../../cache/GlobalCacheClient';

export default function SecurityScopesPage() {
  const [scopes, setScopes] = useState<ScopeAssignmentDto[]>([]);
  const [users, setUsers] = useState<UserListItemDto[]>([]);
  const [roles, setRoles] = useState<RoleListItemDto[]>([]);
  const [nodes, setNodes] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingScope, setEditingScope] = useState<ScopeAssignmentDto | null>(null);
  const [isPending, startTransition] = useTransition();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [assignmentEffect, setAssignmentEffect] = useState<'allow' | 'deny'>('allow');
  const [propagation, setPropagation] = useState<'self' | 'subtree'>('subtree');
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [resScopes, resUsers, resRoles] = await Promise.all([
      AppCache.admin.listScopeAssignments(),
      AppCache.users.listUsers().then((data) => ({ success: true, data })),
      AppCache.admin.listRoles(),
    ]);

    const allNodes: { id: string; name: string }[] = [];
    const visit = async (parentId: string | null): Promise<void> => {
      const children = await AppCache.admin.listChildren(parentId);
      for (const node of children) {
        allNodes.push({ id: node.id, name: node.name });
        await visit(node.id);
      }
    };
    await visit(null);

    if (resScopes.success && resScopes.data) setScopes(resScopes.data);
    if (resUsers.success && resUsers.data) setUsers(resUsers.data);
    if (resRoles.success && resRoles.data) setRoles(resRoles.data);
    setNodes(allNodes);

    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleOpenCreateModal = () => {
    setEditingScope(null);
    setSelectedUserId('');
    setSelectedNodeId('');
    setSelectedRoleId('');
    setAssignmentEffect('allow');
    setPropagation('subtree');
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (scope: ScopeAssignmentDto) => {
    setEditingScope(scope);
    setSelectedUserId(scope.userId);
    setSelectedNodeId(scope.nodeId);
    setSelectedRoleId(scope.roleId);
    setAssignmentEffect(scope.assignmentEffect);
    setPropagation(scope.propagation);
    setFormError(null);
    setShowCreateModal(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      if (editingScope) {
        const cmd: UpdateScopeAssignmentUiCommand = {
          assignmentId: editingScope.id,
          roleId: selectedRoleId,
          assignmentEffect,
          propagation,
        };
        const res = await AppCache.admin.updateScopeAssignment(cmd);
        if (res.success) {
          setShowCreateModal(false);
          await loadData();
        } else if (res.error) {
          setFormError(res.error);
        }
      } else {
        const cmd: CreateScopeAssignmentUiCommand = {
          userId: selectedUserId,
          nodeId: selectedNodeId,
          roleId: selectedRoleId,
          assignmentEffect,
          propagation,
        };
      const res = await AppCache.admin.createScopeAssignment(cmd);
        if (res.success) {
          setShowCreateModal(false);
          await loadData();
        } else if (res.error) {
          setFormError(res.error);
        }
      }
    });
  };

  const handleDeleteScope = (assignmentId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await AppCache.admin.deleteScopeAssignment({ assignmentId });
      if (res.success) {
        await loadData();
      } else if (res.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <span>🔒</span> Assegnazione Scope (Isolamento Gerarchico)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Associa utenti e ruoli a nodi specifici dell&apos;albero gerarchico configurando effetti (`allow`/`deny`) e propagazione (`self`/`subtree`).
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <span>➕</span> Nuova Assegnazione Scope
        </button>
      </div>

      {/* Errore Generale */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore [{error.code}]:</span> {error.message}
        </div>
      )}

      {/* Tabella Assegnazioni Scope */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Caricamento assegnazioni scope in corso...
          </div>
        ) : scopes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="text-3xl block">🔒</span>
            <p className="text-sm font-semibold text-slate-300">Nessuna assegnazione scope trovata</p>
            <p className="text-xs text-slate-500">Gli utenti senza scope dedicato ereditano i permessi di default.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase font-mono tracking-wider">
                <th className="py-3 px-6">Utente</th>
                <th className="py-3 px-6">Nodo Destinazione</th>
                <th className="py-3 px-6">Ruolo Assegnato</th>
                <th className="py-3 px-6">Effetto</th>
                <th className="py-3 px-6">Propagazione</th>
                <th className="py-3 px-6 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {scopes.map((s) => (
                <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-4 px-6 font-medium text-slate-200 font-mono">
                    {s.userEmail}
                  </td>
                  <td className="py-4 px-6 font-semibold text-slate-100">
                    {s.nodeName}
                  </td>
                  <td className="py-4 px-6">
                    {s.roleName ? (
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono text-[10px]">
                        {s.roleName}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Qualsiasi</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {s.assignmentEffect === 'allow' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
                        ALLOW
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[10px]">
                        DENY
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-400 text-[10px]">
                    {s.propagation === 'subtree' ? 'Subtree (Ricorsivo)' : 'Self (Solo Nodo)'}
                  </td>
                  <td className="py-4 px-6 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEditModal(s)}
                      disabled={isPending}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      ✏️ Modifica
                    </button>
                    <button
                      onClick={() => handleDeleteScope(s.id)}
                      disabled={isPending}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors"
                    >
                      Rimuovi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Creazione / Modifica Scope */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>🔒</span> {editingScope ? 'Modifica Scope' : 'Nuova Assegnazione Scope'}
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

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Utente *
                </label>
                <select
                  required
                  disabled={Boolean(editingScope)}
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500 disabled:opacity-60"
                >
                  <option value="">-- Scegli un utente --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nodo *
                </label>
                <select
                  required
                  disabled={Boolean(editingScope)}
                  value={selectedNodeId}
                  onChange={(e) => setSelectedNodeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500 disabled:opacity-60"
                >
                  <option value="">-- Scegli un nodo --</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} (ID: {n.id.substring(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Ruolo associato allo scope *
                </label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Scegli un ruolo --</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.roleKey})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Effetto *
                  </label>
                  <select
                    value={assignmentEffect}
                    onChange={(e) => setAssignmentEffect(e.target.value as 'allow' | 'deny')}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="allow">ALLOW (Consenti)</option>
                    <option value="deny">DENY (Nega)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Propagazione *
                  </label>
                  <select
                    value={propagation}
                    onChange={(e) => setPropagation(e.target.value as 'self' | 'subtree')}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="subtree">Subtree (Sottoalbero)</option>
                    <option value="self">Self (Solo Nodo)</option>
                  </select>
                </div>
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
                  disabled={isPending || !selectedUserId || !selectedNodeId || !selectedRoleId}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {isPending ? 'Salvataggio...' : editingScope ? 'Salva Modifiche' : 'Crea Assegnazione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
