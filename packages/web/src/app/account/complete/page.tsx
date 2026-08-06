'use client';

import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { completeAccountActionAction } from '../../actions/accountRecoveryActions';

function CompletionForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setMessage('Le password non coincidono.'); return; }
    setBusy(true);
    const result = await completeAccountActionAction(token, password);
    setBusy(false);
    setComplete(result.success);
    setMessage(result.success ? 'Password impostata e sessioni precedenti revocate.' : result.error);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Completa il tuo account</h1>
        {!complete ? (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-600">Scegli una password di almeno 12 caratteri con maiuscola, minuscola, numero e simbolo.</p>
            <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Nuova password" />
            <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Ripeti la password" />
            <button disabled={busy || !token} className="w-full rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Verifica…' : 'Imposta password'}</button>
          </form>
        ) : <Link href="/login" className="inline-block rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">Vai al login</Link>}
        {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      </section>
    </main>
  );
}

export default function AccountCompletionPage() {
  return <Suspense fallback={null}><CompletionForm /></Suspense>;
}
