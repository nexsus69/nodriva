'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RoleDetailDto, ApiErrorResponse } from '@dashboard/core';
import {
  getRoleByKeyAction,
  updateRolePermissionsAction,
} from '../../../../actions/securityActions';

export default function RoleDetailPage() {
  const params = useParams();
  const roleKey = params.roleKey as string;

  const [role, setRole] = useState<RoleDetailDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!roleKey) return;
    const timer = window.setTimeout(() => {
      getRoleByKeyAction(roleKey).then((res) => {
        if (res.success && res.data) {
          setRole(res.data);
          setSelectedPermissionIds(res.data.permissions.map((p) => p.id));
        } else if (res.error) {
          setError(res.error);
        }
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [roleKey]);

  const handlePermissionToggle = (permId: string) => {
    if (role?.isSystem) return;
    setSelectedPermissionIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleSavePermissions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || role.isSystem) return;
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await updateRolePermissionsAction({
        roleKey: role.roleKey,
        permissionIds: selectedPermissionIds,
        expectedRowVersion: role.rowVersion,
      });
      if (res.success && res.data) {
        setRole(res.data);
        setSelectedPermissionIds(res.data.permissions.map((p) => p.id));
        setSuccessMsg('Matrice permessi aggiornata con successo.');
      } else if (res.error) {
        setError(res.error);
      }
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Caricamento dettaglio ruolo in corso...
      </div>
    );
  }

  if (!role) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/security/roles"
          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          &larr; Torna alla lista ruoli
        </Link>
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-2">
          <p className="font-bold">Impossibile caricare il ruolo</p>
          <p>{error?.message ?? 'Ruolo non trovato.'}</p>
        </div>
      </div>
    );
  }

  // Raggruppa i permessi per resourceKind
  const groupedPermissions: Record<string, typeof role.allAvailablePermissions> = {};
  for (const perm of role.allAvailablePermissions) {
    const kind = perm.resourceKind || 'Generale';
    if (!groupedPermissions[kind]) groupedPermissions[kind] = [];
    groupedPermissions[kind].push(perm);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/security/roles"
          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mb-2"
        >
          &larr; Torna alla lista ruoli
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
              <span>🛡️</span> Ruolo: {role.name}
            </h1>
            <p className="text-xs font-mono text-purple-400 mt-0.5">{role.roleKey}</p>
          </div>
          {role.isSystem && (
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
              🔒 Ruolo di Sistema (Protetto)
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <span className="font-bold">Errore [{error.code}]:</span> {error.message}
        </div>
      )}

      {/* Form Matrice Permessi */}
      <form onSubmit={handleSavePermissions} className="space-y-6">
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-200">Matrice Permessi Atomici</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Seleziona le capabilities che il ruolo attribuisce all&apos;utente.
              </p>
            </div>
            {!role.isSystem && (
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50"
              >
                {isPending ? 'Salvataggio...' : 'Salva Permessi'}
              </button>
            )}
          </div>

          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([kind, perms]) => (
              <div key={kind} className="space-y-3">
                <h3 className="text-xs font-semibold text-purple-300 font-mono tracking-wider uppercase border-b border-slate-800/60 pb-1">
                  Risorsa: {kind} ({perms.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {perms.map((perm) => {
                    const isChecked = selectedPermissionIds.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                          role.isSystem ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                        } ${
                          isChecked
                            ? 'bg-purple-600/10 border-purple-500/40 text-purple-200'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={role.isSystem}
                          checked={isChecked}
                          onChange={() => handlePermissionToggle(perm.id)}
                          className="mt-0.5 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold block">{perm.name}</span>
                          <span className="text-[10px] font-mono text-purple-400 block">
                            {perm.permissionKey}
                          </span>
                          {perm.description && (
                            <p className="text-[10px] text-slate-500">{perm.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
