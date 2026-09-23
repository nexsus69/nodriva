'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from '@/app/components/navigation/GuardedLink';
import { completeAccountActionAction } from '../../../actions/accountRecoveryActions';
import { PasswordInput } from '../../../components/ui/forms';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

export function AccountCompletionForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useAppLocale();
  const submit = async (event: FormEvent) => { event.preventDefault(); if (password !== confirmation) { setMessage(t('accountCompletion.passwordMismatch')); return; } setBusy(true); const result = await completeAccountActionAction(token, password); setBusy(false); setComplete(result.success); setMessage(result.success ? t('accountCompletion.success') : result.error); };
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><section className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"><h1 className="text-2xl font-semibold text-slate-900">{t('accountCompletion.title')}</h1>{!complete ? <form onSubmit={submit} className="space-y-4"><p className="text-sm text-slate-600">{t('accountCompletion.description')}</p><PasswordInput autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={setPassword} className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10" placeholder={t('account.newPassword')} /><PasswordInput autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={setConfirmation} className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10" placeholder={t('accountCompletion.repeatPassword')} /><button disabled={busy || !token} className="w-full rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? t('accountCompletion.verifying') : t('accountCompletion.setPassword')}</button></form> : <Link href="/login" className="inline-block rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">{t('accountCompletion.goToLogin')}</Link>}{message && <p role="status" className="text-sm text-slate-700">{message}</p>}</section></main>;
}
