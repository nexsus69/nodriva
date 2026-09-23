/** Renders the login form panel and its protected-access context. */

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PasswordInput } from '../../components/ui/forms';
import { useLogin } from '../_hooks/useLogin';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

export function LoginFormPanel() {
  const controller = useLogin();
  const { t } = useAppLocale();
  return <section className="flex min-h-[680px] flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:px-12 xl:px-16"><div className="mx-auto w-full max-w-md">
    <div><p className="text-sm font-medium text-indigo-500">{t('login.welcome')}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{t('login.title')}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{t('login.description')}</p></div>
    <Suspense fallback={null}><SessionWarning message={t('login.sessionExpired')} /></Suspense>
    <form className="mt-8 space-y-5" action={controller.submit}>
      <LoginField label={t('login.email')}><input name="email" type="email" autoComplete="email" required placeholder={t('login.emailPlaceholder')} className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" /></LoginField>
      <LoginField label={t('login.mfaCode')}><input name="mfaCode" inputMode="numeric" autoComplete="one-time-code" placeholder={t('login.mfaPlaceholder')} className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" /></LoginField>
      <LoginField label={t('login.password')}><PasswordInput name="password" autoComplete="current-password" required value={controller.password} onChange={controller.setPassword} placeholder={t('login.passwordPlaceholder')} className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" /></LoginField>
      {controller.error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{controller.error}</div>}
      <button type="submit" disabled={controller.isLoading} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white shadow-lg disabled:opacity-50">{controller.isLoading ? t('login.signingIn') : <>{t('login.signIn')} <span aria-hidden="true">→</span></>}</button>
    </form>
    <p className="mt-10 text-center text-xs text-slate-400">{t('login.protectedAccess')} · Nodriva</p>
  </div></section>;
}

function LoginField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-700">{label}<span className="mt-2 block">{children}</span></label>; }
function SessionWarning({ message }: { message: string }) { return useSearchParams().get('error') === 'SessionExpired' ? <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">⚠ {message}</div> : null; }
