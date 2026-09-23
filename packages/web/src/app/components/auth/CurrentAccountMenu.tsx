'use client';

import { useRouter } from 'next/navigation';
import { useNavigationConfirmation } from '@/app/navigation/NavigationBlocker';
import { ActionMenu } from '@/app/components/ui/menu';
import { useLogout } from '@/app/components/ui/LogoutButton';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

/** Uses the same contextual-menu primitive as resource actions, with a profile avatar as trigger. */
export function CurrentAccountMenu({ email, initials, className = '', light = false }: { email: string; initials: string; className?: string; light?: boolean }) {
  const router = useRouter();
  const { t } = useAppLocale();
  const confirmNavigation = useNavigationConfirmation();
  const { logout, isLoggingOut } = useLogout();
  const navigate = (href: string) => void (async () => {
    if (await confirmNavigation()) router.push(href);
  })();
  return <ActionMenu
    className={className}
    label={t('account.menu')}
    trigger={<span className={`flex items-center gap-3 rounded-xl p-2 text-left transition ${light ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-200 ring-1 ring-indigo-400/20">{initials}</span>
      <span className="min-w-0 flex-1"><span className={`block truncate text-xs font-semibold ${light ? 'text-slate-800' : 'text-slate-100'}`}>{email}</span><span className={`mt-0.5 block text-[11px] ${light ? 'text-slate-500' : 'text-emerald-400'}`}>{t('account.sessionActive')}</span></span>
      <span aria-hidden="true" className={`text-sm ${light ? 'text-slate-500' : 'text-slate-400'}`}>⌄</span>
    </span>}
    items={[
      { id: 'account', label: t('account.title'), onSelect: () => navigate('/account') },
      { id: 'security', label: t('account.security'), onSelect: () => navigate('/account/security') },
      { id: 'logout', label: isLoggingOut ? t('account.loggingOut') : t('account.logout'), destructive: true, disabled: isLoggingOut, onSelect: () => void logout() },
    ]}
  />;
}
