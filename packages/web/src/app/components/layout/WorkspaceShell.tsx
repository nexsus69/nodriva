/** Composes the authenticated workspace shell and its responsive navigation. */

'use client';

import Link from '@/app/components/navigation/GuardedLink';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { CurrentAccountMenu } from '../auth/CurrentAccountMenu';
import { Skeleton } from '../ui/feedback';
import { MobileDrawer } from '../ui/menu';
import { AppFooter } from './AppFooter';
import { AdminIcon } from '@/adminPanel/components/AdminIcon';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

function initials(email: string): string {
  const parts = email.split('@')[0]?.split(/[._-]/).filter(Boolean) ?? [];
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function WorkspaceNavigation({ onNavigate, pathname }: { onNavigate: () => void; pathname?: string }) {
  const { t } = useAppLocale();
  const navigationItems = [
    { href: '/', label: t('workspace.overview'), description: t('workspace.operational'), icon: '⌂' },
  ];
  return (
    <>
      <div className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{t('workspace.title')}</div>
      <nav aria-label={t('workspace.navigation')} className="mt-3 space-y-1">
        {navigationItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={onNavigate} className={`flex items-center gap-3 px-3 py-3 transition ${pathname === item.href ? 'bg-white/10 text-white ring-1 ring-inset ring-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
            <span className={`flex h-8 w-8 items-center justify-center text-lg ${pathname === item.href ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-white/5 text-slate-500'}`} aria-hidden="true">{item.icon}</span>
            <span><strong className="block text-sm font-semibold">{item.label}</strong><small className="block text-[11px] text-slate-500">{item.description}</small></span>
          </Link>
        ))}
      </nav>
      <div className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{t('workspace.administration')}</div>
      <Link href="/admin" onClick={onNavigate} className="mt-3 flex items-center gap-3 px-3 py-3 text-slate-400 transition hover:bg-white/5 hover:text-slate-100">
        <span className="flex h-8 w-8 items-center justify-center bg-white/5 text-base text-slate-500" aria-hidden="true"><AdminIcon name="settings" className="size-4" /></span>
        <span><strong className="block text-sm font-semibold">{t('workspace.controlCenter')}</strong><small className="block text-[11px] text-slate-500">{t('workspace.systemConfiguration')}</small></span>
      </Link>
    </>
  );
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t } = useAppLocale();

  if (pathname === '/login' || pathname === '/account/complete' || pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  const email = session?.user?.email ?? t('workspace.authenticatedUser');
  const userInitials = initials(email);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px]">
        <aside className="hidden w-[248px] flex-col border-r border-slate-800 bg-[#111827] px-4 py-5 text-slate-100 shadow-xl shadow-slate-950/20 lg:flex lg:shadow-none">
          <div className="flex items-center justify-between px-2">
            <Link href="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center bg-white/10 text-lg font-bold text-white ring-1 ring-white/15">N</span>
              <span><strong className="block text-sm tracking-tight text-white">Nodriva</strong><small className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300">{t('workspace.title')}</small></span>
            </Link>
            <button type="button" onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:bg-white/10 lg:hidden" aria-label={t('workspace.closeMenu')}>×</button>
          </div>

          <div className="mt-9"><WorkspaceNavigation pathname={pathname} onNavigate={() => setIsSidebarOpen(false)} /></div>

          <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
            {status === 'loading' ? <span role="status" aria-label={t('workspace.loadingSession')}><Skeleton className="h-12 w-full" /></span> : <CurrentAccountMenu email={email} initials={userInitials} />}
          </div>
        </aside>

        <MobileDrawer open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} title="Nodriva">
          <WorkspaceNavigation pathname={pathname} onNavigate={() => setIsSidebarOpen(false)} />
          <CurrentAccountMenu email={email} initials={userInitials} className="mt-6" light />
        </MobileDrawer>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/85 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsSidebarOpen(true)} className="border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm lg:hidden" aria-label={t('workspace.openNavigation')}><AdminIcon name="menu" className="size-5" /></button>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">{t('workspace.operational')}</p><p className="mt-1 text-sm font-semibold text-slate-800">{t('workspace.overviewAndHierarchy')}</p></div>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {t('workspace.systemOperational')}</div>
          </header>
          <main className="flex-1 px-5 py-7 sm:px-8 lg:px-10"><div className="mx-auto w-full max-w-7xl">{children}</div></main>
          <AppFooter />
        </div>
      </div>
    </div>
  );
}
