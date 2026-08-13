import type { FormEventHandler } from 'react';
import type { ApiErrorResponse } from '@dashboard/core';
import { AdminModalShell } from '../../../_components/AdminModalShell';
import { PasswordInput } from '../../../../components/ui/forms';

interface UserDetailModalsProps {
  showEditModal: boolean;
  showPasswordModal: boolean;
  editEmail: string;
  editIsSuperAdmin: boolean;
  newPassword: string;
  confirmPassword: string;
  error: ApiErrorResponse | null;
  isPending: boolean;
  setEditEmail: (value: string) => void;
  setEditIsSuperAdmin: (value: boolean) => void;
  setNewPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  closeEditModal: () => void;
  closePasswordModal: () => void;
  onSaveUser: FormEventHandler<HTMLFormElement>;
  onResetPassword: FormEventHandler<HTMLFormElement>;
}

export function UserDetailModals({
  showEditModal,
  showPasswordModal,
  editEmail,
  editIsSuperAdmin,
  newPassword,
  confirmPassword,
  error,
  isPending,
  setEditEmail,
  setEditIsSuperAdmin,
  setNewPassword,
  setConfirmPassword,
  closeEditModal,
  closePasswordModal,
  onSaveUser,
  onResetPassword,
}: UserDetailModalsProps) {
  return (
    <>
      {showEditModal && (
        <AdminModalShell>
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2"><span>✏️</span> Modifica Anagrafica Utente</h3>
            <button type="button" onClick={closeEditModal} aria-label="Chiudi modifica utente" className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
          </div>
          <form onSubmit={onSaveUser} className="space-y-4">
            <div>
              <label htmlFor="edit-user-email" className="block text-xs font-medium text-slate-300 mb-1">Email Utente *</label>
              <input id="edit-user-email" name="email" type="email" required value={editEmail} onChange={(event) => setEditEmail(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="editIsSuperAdmin" name="isSuperAdmin" checked={editIsSuperAdmin} onChange={(event) => setEditIsSuperAdmin(event.target.checked)} className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500" />
              <label htmlFor="editIsSuperAdmin" className="text-xs text-slate-300 font-medium">Privilegio Super Admin</label>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
              <button type="button" onClick={closeEditModal} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50">Annulla</button>
              <button type="submit" disabled={isPending || !editEmail.trim()} className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50">
                {isPending ? 'Salvataggio in corso...' : 'Salva modifiche'}
              </button>
            </div>
          </form>
        </AdminModalShell>
      )}

      {showPasswordModal && (
        <AdminModalShell>
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <h3 className="text-base font-bold text-slate-100">🔑 Reimposta Password</h3>
            <button type="button" onClick={closePasswordModal} aria-label="Chiudi reset password" className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
          </div>
          <p className="text-xs text-slate-400">Il reset invaliderà immediatamente tutte le sessioni attive dell&apos;utente.</p>
          {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><span className="font-bold">Errore [{error.code}]:</span> {error.message}</div>}
          <form onSubmit={onResetPassword} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-xs font-medium text-slate-300 mb-1">Nuova password *</label>
              <PasswordInput id="newPassword" name="newPassword" required minLength={12} autoComplete="new-password" value={newPassword} onChange={setNewPassword} placeholder="12+ caratteri, maiuscola, minuscola, numero e simbolo" />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-300 mb-1">Conferma password *</label>
              <PasswordInput id="confirmPassword" name="confirmPassword" required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
              <button type="button" onClick={closePasswordModal} className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800/50">Annulla</button>
              <button type="submit" disabled={isPending || newPassword.length < 12 || newPassword !== confirmPassword} className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50">
                {isPending ? 'Aggiornamento...' : 'Reimposta e revoca sessioni'}
              </button>
            </div>
          </form>
        </AdminModalShell>
      )}
    </>
  );
}
