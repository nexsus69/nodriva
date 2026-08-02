'use client';

import React, { useEffect } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 id="confirm-modal-title" className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" disabled={busy} onClick={onConfirm} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:cursor-wait disabled:opacity-50">
            {busy ? 'Attendere…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
