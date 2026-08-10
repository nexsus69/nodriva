'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type {
  UserDetailDto,
  ApiErrorResponse,
} from '@dashboard/core';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { AdminModalShell } from '../../_components/AdminModalShell';
import { issueAccountActionAction } from '../../../actions/accountRecoveryActions';
import { UserAccountDetailsPanel, UserRoleAssignmentPanel } from '../_components/UserDetailPanels';
import { PasswordInput } from '../../../components/ui/forms';

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserDetailDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editIsSuperAdmin, setEditIsSuperAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AppCache.users.getUser(userId).then((data) => {
      if (cancelled) return;
      setUser(data);
      setSelectedRoleIds(data.roles.map((r) => r.id));
      setEditEmail(data.email);
      setEditIsSuperAdmin(data.isSuperAdmin);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err as ApiErrorResponse);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleToggleStatus = () => {
    if (!user) return;
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const data = await AppCache.users.updateUserStatus({
          userId: user.id,
          isActive: !user.isActive,
          expectedRowVersion: user.rowVersion,
        });
        setUser(data);
        setSuccessMsg(
          data.isActive
            ? 'Account attivato con successo.'
            : 'Account disabilitato con successo.'
        );
      } catch (err) {
        setError(err as ApiErrorResponse);
      }
    });
  };

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSaveRoles = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const data = await AppCache.users.assignUserRoles({
          userId: user.id,
          roleIds: selectedRoleIds,
          expectedRowVersion: user.rowVersion,
        });
        setUser(data);
        setSelectedRoleIds(data.roles.map((r) => r.id));
        setSuccessMsg('Ruoli utente aggiornati con successo.');
      } catch (err) {
        setError(err as ApiErrorResponse);
      }
    });
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const data = await AppCache.users.updateUser({
          userId: user.id,
          email: editEmail.trim(),
          isSuperAdmin: editIsSuperAdmin,
          expectedRowVersion: user.rowVersion,
        });
        setUser(data);
        setShowEditModal(false);
        setSuccessMsg('Dati utente aggiornati con successo.');
      } catch (err) {
        setError(err as ApiErrorResponse);
      }
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccessMsg(null);
    if (newPassword !== confirmPassword) {
      setError({ code: 'VALIDATION_ERROR', message: 'Le password non coincidono.' });
      return;
    }

    startTransition(async () => {
      try {
        const data = await AppCache.users.resetUserPassword({
          userId: user.id,
          newPassword,
          expectedRowVersion: user.rowVersion,
        });
        setUser(data);
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordModal(false);
        setSuccessMsg('Password aggiornata e sessioni attive revocate.');
      } catch (err) {
        setError(err as ApiErrorResponse);
      }
    });
  };

  const handleIssueAccountAction = (purpose: 'invitation' | 'password_reset') => {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      try {
        const result = await issueAccountActionAction(userId, purpose);
        setSuccessMsg(`Email inviata. Il link scade il ${new Date(result.expiresAt).toLocaleString()}.`);
      } catch (err) {
        setError({ code: 'UNKNOWN_ERROR', message: err instanceof Error ? err.message : 'Invio non riuscito.' });
      }
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Caricamento dettaglio utente in corso...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/users"
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
        >
          &larr; Torna alla lista utenti
        </Link>
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-2">
          <p className="font-bold">Impossibile caricare l&apos;utente</p>
          <p>{error?.message ?? 'Utente non trovato.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Torna Indietro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/users"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mb-2"
          >
            &larr; Torna alla lista utenti
          </Link>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
            <span>👤</span> {user.email}
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {user.id}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setEditEmail(user.email);
              setEditIsSuperAdmin(user.isSuperAdmin);
              setShowEditModal(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all"
          >
            ✏️ Modifica Dati
          </button>
          <button
            onClick={() => {
              setError(null);
              setNewPassword('');
              setConfirmPassword('');
              setShowPasswordModal(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-all"
          >
            🔑 Reimposta Password
          </button>
          <button
            onClick={() => handleIssueAccountAction('password_reset')}
            disabled={isPending}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 transition-all disabled:opacity-50"
          >
            Invia link reset
          </button>
          <button
            onClick={() => handleIssueAccountAction('invitation')}
            disabled={isPending}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 transition-all disabled:opacity-50"
          >
            Invia invito
          </button>
          <button
            onClick={handleToggleStatus}
            disabled={isPending}
            className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
              user.isActive
                ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
            }`}
          >
          {isPending
            ? 'Aggiornamento...'
            : user.isActive
            ? '🚫 Disabilita Account'
            : '✅ Attiva Account'}
        </button>
        </div>
      </div>

      {/* Messaggio di Feedback */}
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

      {/* Informazioni Anagrafiche & Stato */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UserAccountDetailsPanel user={user} />

        {/* Modulo Assegnazione Ruoli */}
        <UserRoleAssignmentPanel user={user} selectedRoleIds={selectedRoleIds} isPending={isPending} onToggle={handleRoleToggle} onSubmit={handleSaveRoles} />
      </div>

      {/* Modal Modifica Dati Utente */}
      {showEditModal && (
        <AdminModalShell>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>✏️</span> Modifica Anagrafica Utente
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Utente *
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="editIsSuperAdmin"
                  checked={editIsSuperAdmin}
                  onChange={(e) => setEditIsSuperAdmin(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="editIsSuperAdmin" className="text-xs text-slate-300 font-medium">
                  Privilegio Super Admin
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending || !editEmail.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isPending ? 'Salvataggio in corso...' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
        </AdminModalShell>
      )}

      {showPasswordModal && (
        <AdminModalShell>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h3 className="text-base font-bold text-slate-100">🔑 Reimposta Password</h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Il reset invaliderà immediatamente tutte le sessioni attive dell&apos;utente.
            </p>
            {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><span className="font-bold">Errore [{error.code}]:</span> {error.message}</div>}
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nuova password *</label>
                <PasswordInput
                  id="newPassword"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="12+ caratteri, maiuscola, minuscola, numero e simbolo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Conferma password *</label>
                <PasswordInput
                  id="confirmPassword"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800/50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending || newPassword.length < 12 || newPassword !== confirmPassword}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
                >
                  {isPending ? 'Aggiornamento...' : 'Reimposta e revoca sessioni'}
                </button>
              </div>
            </form>
        </AdminModalShell>
      )}
    </div>
  );
}
