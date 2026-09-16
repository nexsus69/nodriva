/** Renders the login form panel and its protected-access context. */

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PasswordInput } from '../../components/ui/forms';
import { useLogin } from '../_hooks/useLogin';

export function LoginFormPanel() {
  const controller = useLogin();
  return <section className="flex min-h-[680px] flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:px-12 xl:px-16"><div className="mx-auto w-full max-w-md">
    <div><p className="text-sm font-medium text-indigo-500">Benvenuto</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Accedi al tuo spazio</h2><p className="mt-3 text-sm leading-6 text-slate-500">Inserisci le tue credenziali per continuare.</p></div>
    <Suspense fallback={null}><SessionWarning /></Suspense>
    <form className="mt-8 space-y-5" action={controller.submit}>
      <LoginField label="Email"><input name="email" type="email" autoComplete="email" required placeholder="nome@azienda.it" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" /></LoginField>
      <LoginField label="Codice MFA (se configurato)"><input name="mfaCode" inputMode="numeric" autoComplete="one-time-code" placeholder="Codice TOTP o di recupero" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" /></LoginField>
      <LoginField label="Password"><PasswordInput name="password" autoComplete="current-password" required value={controller.password} onChange={controller.setPassword} placeholder="Inserisci la password" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" /></LoginField>
      {controller.error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{controller.error}</div>}
      <button type="submit" disabled={controller.isLoading} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white shadow-lg disabled:opacity-50">{controller.isLoading ? 'Accesso in corso...' : <>Accedi <span aria-hidden="true">→</span></>}</button>
    </form>
    <p className="mt-10 text-center text-xs text-slate-400">Protected access · Nodriva</p>
  </div></section>;
}

function LoginField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-700">{label}<span className="mt-2 block">{children}</span></label>; }
function SessionWarning() { return useSearchParams().get('error') === 'SessionExpired' ? <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">⚠ La tua sessione è scaduta per inattività. Effettua nuovamente l&apos;accesso.</div> : null; }
