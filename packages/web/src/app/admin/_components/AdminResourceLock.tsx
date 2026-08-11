'use client';

import type { ResourceKind } from '@dashboard/core';
import { useLock } from '../../hooks/useLock';

interface AdminResourceLockProps {
  resourceType: Exclude<ResourceKind, 'node' | 'entity'>;
  resourceId: string;
  className?: string;
}

/** Shared lock control for administrative detail editors. */
export function AdminResourceLock({ resourceType, resourceId, className = '' }: AdminResourceLockProps) {
  const { lockedByOther, isMyLock, acquireLock, releaseLock, error } = useLock({ resourceType, resourceId });

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
      lockedByOther.locked
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : isMyLock
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : 'border-slate-700 bg-slate-900/40 text-slate-300'
    } ${className}`}>
      <div>
        <p className="font-semibold">
          {lockedByOther.locked
            ? 'Modifica temporaneamente bloccata da un altro utente.'
            : isMyLock
              ? 'Lock amministrativo attivo: puoi modificare questa risorsa.'
              : 'Acquisisci il lock prima di modificare questa risorsa.'}
        </p>
        {lockedByOther.locked && lockedByOther.byUserId && <p className="mt-1 opacity-80">Proprietario: {lockedByOther.byUserId}</p>}
        {error && <p className="mt-1 text-rose-300">{error}</p>}
      </div>
      {isMyLock ? (
        <button type="button" onClick={() => void releaseLock()} className="rounded-lg border border-emerald-400/30 px-3 py-1.5 font-semibold hover:bg-emerald-400/10">Rilascia lock</button>
      ) : !lockedByOther.locked ? (
        <button type="button" onClick={() => void acquireLock()} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500">Acquisisci lock</button>
      ) : null}
    </div>
  );
}
