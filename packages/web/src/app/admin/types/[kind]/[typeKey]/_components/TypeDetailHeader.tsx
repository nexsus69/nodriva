import Link from '@/app/components/navigation/GuardedLink';
import type { ApiErrorResponse, TypeDetailDto } from '@dashboard/core';

interface TypeDetailHeaderProps {
  detail: TypeDetailDto;
  isPending: boolean;
  error: ApiErrorResponse | null;
  conflictError: ApiErrorResponse | null;
  successMessage: string | null;
  onReload: () => void;
  onToggleActive: () => void;
  onDismissSuccess: () => void;
}

export function TypeDetailHeader({ detail, isPending, error, conflictError, successMessage, onReload, onToggleActive, onDismissSuccess }: TypeDetailHeaderProps) {
  return (
    <>
      <div className="space-y-2">
        <Link href="/admin/types" className="text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1 w-fit transition-colors">← Torna alla lista tipi</Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">{detail.name}</h1>
            <span className="font-mono text-xs px-2.5 py-1 bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 rounded-md">{detail.typeKey}</span>
            {detail.isSystem && <span className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-md">🔒 SYSTEM TYPE</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleActive}
              disabled={!detail.isEditable || isPending}
              className={detail.isActive
                ? 'px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed'
                : 'px-3.5 py-2 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed'}
            >
              {detail.isActive ? 'Disabilita Tipo' : 'Riattiva Tipo'}
            </button>
            {!detail.isActive && <span className="px-3 py-1.5 bg-slate-800 text-rose-400 text-xs font-medium rounded-lg">Stato: Disabilitato</span>}
          </div>
        </div>
      </div>

      {conflictError && (
        <div className="p-5 bg-amber-950/60 border border-amber-500/50 rounded-2xl text-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div>
            <h4 className="font-bold text-amber-100 flex items-center gap-2"><span>⚠️</span> Conflitto di Concorrenza (Row Version Mismatch)</h4>
            <p className="text-xs text-amber-300/90 mt-1">{conflictError.message}</p>
          </div>
          <button type="button" onClick={onReload} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all whitespace-nowrap">🔄 Ricarica Scheda</button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex justify-between">
          <span>✅ {successMessage}</span>
          <button type="button" onClick={onDismissSuccess} aria-label="Chiudi messaggio" className="text-emerald-400 text-xs font-bold">✕</button>
        </div>
      )}
      {error && !conflictError && <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-sm">⚠️ {error.message}</div>}
    </>
  );
}
