'use client';

import { useEffect, useState, useTransition } from 'react';
import { getNodeTypeAttachmentPolicyAction, updateNodeTypeAttachmentPolicyAction, type AttachmentEncryptionMode } from '../../../actions/typeActions';

export function NodeTypeEncryptionPolicy({ nodeTypeId }: { nodeTypeId: string }) {
  const [mode, setMode] = useState<AttachmentEncryptionMode>('disabled');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void getNodeTypeAttachmentPolicyAction(nodeTypeId).then((result) => { if (result.success && result.mode) setMode(result.mode); });
  }, [nodeTypeId]);

  const update = (nextMode: AttachmentEncryptionMode) => {
    setMode(nextMode);
    setMessage(null);
    startTransition(async () => {
      const result = await updateNodeTypeAttachmentPolicyAction(nodeTypeId, nextMode);
      setMessage(result.success ? 'Policy aggiornata.' : result.error?.message ?? 'Errore aggiornamento policy.');
    });
  };

  return <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2"><div><h3 className="text-sm font-semibold text-slate-100">Cifratura allegati</h3><p className="text-xs text-slate-400">L&apos;upload resta sempre disponibile. La policy enabled agisce solo quando la cifratura globale è attiva; si applica anche alle entità contenute nei nodi di questo tipo.</p></div><select value={mode} disabled={isPending} onChange={(event) => update(event.target.value as AttachmentEncryptionMode)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"><option value="disabled">Non cifrare</option><option value="enabled">Cifra quando la globale è attiva</option></select>{message && <p className="text-xs text-slate-400">{message}</p>}</section>;
}
