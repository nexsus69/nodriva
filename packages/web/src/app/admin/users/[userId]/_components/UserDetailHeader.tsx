import Link from 'next/link';
import type { UserDetailDto } from '@dashboard/core';

interface UserDetailHeaderProps {
  user: UserDetailDto;
  isPending: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onIssueAccountAction: (purpose: 'invitation' | 'password_reset') => void;
  onToggleStatus: () => void;
}

export function UserDetailHeader({
  user,
  isPending,
  onEdit,
  onResetPassword,
  onIssueAccountAction,
  onToggleStatus,
}: UserDetailHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <Link href="/admin/users" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mb-2">
          &larr; Torna alla lista utenti
        </Link>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
          <span>👤</span> {user.email}
        </h1>
        <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {user.id}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onEdit} className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all">
          ✏️ Modifica Dati
        </button>
        <button type="button" onClick={onResetPassword} className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-all">
          🔑 Reimposta Password
        </button>
        <button type="button" onClick={() => onIssueAccountAction('password_reset')} disabled={isPending} className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 transition-all disabled:opacity-50">
          Invia link reset
        </button>
        <button type="button" onClick={() => onIssueAccountAction('invitation')} disabled={isPending} className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 transition-all disabled:opacity-50">
          Invia invito
        </button>
        <button
          type="button"
          onClick={onToggleStatus}
          disabled={isPending}
          className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${user.isActive ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30' : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'}`}
        >
          {isPending ? 'Aggiornamento...' : user.isActive ? '🚫 Disabilita Account' : '✅ Attiva Account'}
        </button>
      </div>
    </div>
  );
}
