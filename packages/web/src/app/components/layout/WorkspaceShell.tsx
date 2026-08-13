'use client';

import Link from '@/app/components/navigation/GuardedLink';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { LogoutButton } from '../ui/LogoutButton';
import { MobileDrawer } from '../ui/menu';

const NAV_ITEMS = [
  { href: '/', label: 'Panoramica', description: 'Workspace operativo', icon: '⌂' },
];

function initials(email: string): string {
  const parts = email.split('@')[0]?.split(/[._-]/).filter(Boolean) ?? [];
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function WorkspaceNavigation({ onNavigate, pathname }: { onNavigate: () => void; pathname?: string }) {
  return (
    <>
      <div className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Workspace</div>
      <nav aria-label="Navigazione workspace" className="mt-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} onClick={onNavigate} className={`flex items-center gap-3 rounded-lg px-3 py-3 transition ${pathname === item.href ? 'bg-white/10 text-white ring-1 ring-inset ring-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${pathname === item.href ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-white/5 text-slate-500'}`} aria-hidden="true">{item.icon}</span>
            <span><strong className="block text-sm font-semibold">{item.label}</strong><small className="block text-[11px] text-slate-500">{item.description}</small></span>
          </Link>
        ))}
      </nav>
      <div className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Amministrazione</div>
      <Link href="/admin" onClick={onNavigate} className="mt-3 flex items-center gap-3 rounded-lg px-3 py-3 text-slate-400 transition hover:bg-white/5 hover:text-slate-100">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-base text-slate-500" aria-hidden="true">⚙</span>
        <span><strong className="block text-sm font-semibold">Centro di controllo</strong><small className="block text-[11px] text-slate-500">Configurazione sistema</small></span>
      </Link>
    </>
  );
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (pathname === '/login' || pathname === '/account/complete' || pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  const email = session?.user?.email ?? 'Utente autenticato';
  const userInitials = initials(email);

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px]">
        <aside className="hidden w-[248px] flex-col border-r border-slate-800 bg-[#111827] px-4 py-5 text-slate-100 shadow-xl shadow-slate-950/20 lg:flex lg:shadow-none">
          <div className="flex items-center justify-between px-2">
            <Link href="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg font-bold text-white ring-1 ring-white/15">D</span>
              <span><strong className="block text-sm tracking-tight text-white">Dashboard</strong><small className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300">Ultimate</small></span>
            </Link>
            <button type="button" onClick={() => setIsSidebarOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden" aria-label="Chiudi menu">×</button>
          </div>

          <div className="mt-9"><WorkspaceNavigation pathname={pathname} onNavigate={() => setIsSidebarOpen(false)} /></div>

          <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-200 ring-1 ring-indigo-400/20">{status === 'loading' ? '··' : userInitials}</span>
              <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-100">{status === 'loading' ? 'Caricamento…' : email}</p><p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Sessione attiva</p></div>
            </div>
            <LogoutButton className="mt-3 w-full justify-center border-white/10 bg-white/5 text-slate-300 hover:bg-rose-500/10 hover:text-rose-300" />
          </div>
        </aside>

        <MobileDrawer open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} title="Dashboard Ultimate">
          <WorkspaceNavigation pathname={pathname} onNavigate={() => setIsSidebarOpen(false)} />
          <LogoutButton className="mt-6 w-full justify-center border-slate-200 bg-slate-50 text-slate-600" />
        </MobileDrawer>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/85 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsSidebarOpen(true)} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm lg:hidden" aria-label="Apri navigazione">☰</button>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Workspace operativo</p><p className="mt-1 text-sm font-semibold text-slate-800">Panoramica e gerarchia</p></div>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Sistema operativo</div>
          </header>
          <main className="flex-1 px-5 py-7 sm:px-8 lg:px-10"><div className="mx-auto w-full max-w-7xl">{children}</div></main>
        </div>
      </div>
    </div>
  );
}
