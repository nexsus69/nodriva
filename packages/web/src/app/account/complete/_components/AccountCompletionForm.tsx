'use client';

/** Completes a one-time account action while retaining visible mutation feedback. */

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from '@/app/components/navigation/GuardedLink';
import { completeAccountActionAction } from '../../../actions/accountRecoveryActions';
import { PasswordInput } from '../../../components/ui/forms';
import { PasswordRequirements } from '../../../components/ui/forms';
import { isUserPasswordValid } from '@dashboard/core/browser';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';
import { MutationFeedback } from '@/app/mutations/MutationFeedback';
import { useUserMutation } from '@/app/mutations/useUserMutation';

export function AccountCompletionForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [complete, setComplete] = useState(false);
  const mutation = useUserMutation();
  const { t } = useAppLocale();
  const submit = async (event: FormEvent) => { event.preventDefault(); if (password !== confirmation) { mutation.reportValidationFailure(t('accountCompletion.passwordMismatch')); return; } if (!isUserPasswordValid(password)) { mutation.reportValidationFailure(t('account.passwordRequirementsNotMet')); return; } await mutation.execute(async () => { const result = await completeAccountActionAction(token, password); if (!result.success) throw result.error; }, () => setComplete(true)); };
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><section className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"><h1 className="text-2xl font-semibold text-slate-900">{t('accountCompletion.title')}</h1>{!complete ? <form onSubmit={submit} className="space-y-4"><p className="text-sm text-slate-600">{t('accountCompletion.description')}</p><PasswordInput autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={setPassword} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 placeholder:text-slate-500" placeholder={t('account.newPassword')} tone="light" /><PasswordRequirements password={password} /><PasswordInput autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={setConfirmation} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 placeholder:text-slate-500" placeholder={t('accountCompletion.repeatPassword')} tone="light" /><button disabled={mutation.pending || !token || !isUserPasswordValid(password)} className="w-full rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{mutation.pending ? t('accountCompletion.verifying') : t('accountCompletion.setPassword')}</button></form> : <div className="space-y-3"><p role="status" className="text-sm text-emerald-700">{t('accountCompletion.success')}</p><Link href="/login" className="inline-block rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">{t('accountCompletion.goToLogin')}</Link></div>}<MutationFeedback failure={mutation.failure} onRetry={() => void mutation.retry()} /></section></main>;
}
