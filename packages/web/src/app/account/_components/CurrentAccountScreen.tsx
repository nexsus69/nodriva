'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from '@/app/components/navigation/GuardedLink';
import { AppCache } from '@/app/cache/GlobalCacheClient';
import { PasswordInput } from '@/app/components/ui/forms';
import { changeCurrentPasswordAction } from '@/app/actions/currentAccountActions';

export function CurrentAccountScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmation) { setMessage('Le nuove password non coincidono.'); return; }
    setBusy(true); setMessage(null);
    const result = await changeCurrentPasswordAction(currentPassword, newPassword);
    setBusy(false);
    if (!result.success) { setMessage(result.error.message); return; }
    AppCache.purgeAll();
    router.replace('/login');
    router.refresh();
  };

  return <main className="mx-auto max-w-2xl space-y-6 p-6 sm:p-10">
    <div><h1 className="text-2xl font-semibold text-slate-900">Il mio account</h1><p className="mt-2 text-sm text-slate-600">Gestisci l’accesso e la sicurezza del tuo account.</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Identità</h2><p className="mt-1 text-sm text-slate-600">Indirizzo di accesso</p><p className="mt-2 text-sm font-medium text-slate-800">{session?.user?.email ?? 'Utente autenticato'}</p></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Sicurezza</h2><p className="mt-1 text-sm text-slate-600">Configura l’autenticatore, sostituiscilo o usa i codici di recupero.</p><Link href="/account/security" className="mt-4 inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Apri sicurezza account</Link></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Cambia password</h2><p className="mt-1 text-sm text-slate-600">Per protezione tutte le sessioni verranno chiuse e dovrai accedere di nuovo.</p><form onSubmit={submit} className="mt-4 space-y-3"><PasswordInput autoComplete="current-password" required value={currentPassword} onChange={setCurrentPassword} placeholder="Password attuale" className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10" /><PasswordInput autoComplete="new-password" required value={newPassword} onChange={setNewPassword} placeholder="Nuova password" className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10" /><PasswordInput autoComplete="new-password" required value={confirmation} onChange={setConfirmation} placeholder="Ripeti nuova password" className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10" /><button disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Aggiornamento…' : 'Cambia password e disconnetti'}</button></form>{message && <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>}</section>
  </main>;
}
