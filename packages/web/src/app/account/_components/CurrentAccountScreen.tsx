'use client';

/** Renders self-service account security mutations through the shared outcome owner. */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from '@/app/components/navigation/GuardedLink';
import { AppCache } from '@/app/cache/GlobalCacheClient';
import { PasswordInput } from '@/app/components/ui/forms';
import { PasswordRequirements } from '@/app/components/ui/forms';
import { isUserPasswordValid } from '@dashboard/core/browser';
import { changeCurrentPasswordAction } from '@/app/actions/currentAccountActions';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';
import { MutationFeedback } from '@/app/mutations/MutationFeedback';
import { useUserMutation } from '@/app/mutations/useUserMutation';

export function CurrentAccountScreen({ securityHref = '/account/security' }: { securityHref?: string }) {
  const router = useRouter();
  const { t } = useAppLocale();
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const mutation = useUserMutation();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmation) { mutation.reportValidationFailure(t('account.passwordMismatch')); return; }
    if (!isUserPasswordValid(newPassword)) { mutation.reportValidationFailure(t('account.passwordRequirementsNotMet')); return; }
    await mutation.execute(async () => {
      const result = await changeCurrentPasswordAction(currentPassword, newPassword);
      if (!result.success) throw result.error;
    }, () => {
      AppCache.purgeAll();
      router.replace('/login');
      router.refresh();
    });
  };

  return <main className="mx-auto max-w-2xl space-y-6 p-6 sm:p-10">
    <div><h1 className="text-2xl font-semibold text-slate-900">{t('account.title')}</h1><p className="mt-2 text-sm text-slate-600">{t('account.description')}</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">{t('account.identity')}</h2><p className="mt-1 text-sm text-slate-600">{t('account.signInEmail')}</p><p className="mt-2 text-sm font-medium text-slate-800">{session?.user?.email ?? '—'}</p></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">{t('account.security')}</h2><p className="mt-1 text-sm text-slate-600">{t('account.securityDescription')}</p><Link href={securityHref} className="mt-4 inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{t('account.openSecurity')}</Link></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">{t('account.changePassword')}</h2><p className="mt-1 text-sm text-slate-600">{t('account.changePasswordDescription')}</p><form onSubmit={submit} className="mt-4 space-y-3"><PasswordInput autoComplete="current-password" required value={currentPassword} onChange={setCurrentPassword} placeholder={t('account.currentPassword')} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 placeholder:text-slate-500" tone="light" /><PasswordInput autoComplete="new-password" required value={newPassword} onChange={setNewPassword} placeholder={t('account.newPassword')} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 placeholder:text-slate-500" tone="light" /><PasswordRequirements password={newPassword} /><PasswordInput autoComplete="new-password" required value={confirmation} onChange={setConfirmation} placeholder={t('account.repeatPassword')} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 placeholder:text-slate-500" tone="light" /><button disabled={mutation.pending || !isUserPasswordValid(newPassword)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{mutation.pending ? t('account.changingPassword') : t('account.changeAndSignOut')}</button></form><MutationFeedback failure={mutation.failure} onRetry={() => void mutation.retry()} className="mt-3" /></section>
  </main>;
}
