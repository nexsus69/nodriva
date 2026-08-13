'use client';

import Link from 'next/link';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { useAdminShell } from '../_hooks/useAdminShell';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const controller = useAdminShell();
  if (controller.access === 'checking') return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">Verifica autorizzazioni…</div>;
  if (controller.access === 'denied') return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100"><div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center"><div className="text-4xl">🔒</div><h1 className="text-xl font-semibold">Accesso amministrativo negato</h1><p className="text-sm text-slate-400">Il tuo account non dispone di una capacità amministrativa globale.</p><Link href="/" className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Torna al workspace</Link></div></div>;
  return <div className="admin-page flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900"><AdminSidebar pathname={controller.pathname} open={controller.sidebarOpen} onClose={() => controller.setSidebarOpen(false)} /><div className="flex-1 flex flex-col min-w-0 overflow-hidden"><AdminHeader breadcrumbs={controller.breadcrumbs} email={controller.email} initials={controller.initials} loadingSession={controller.sessionStatus === 'loading'} onOpenSidebar={() => controller.setSidebarOpen(true)} /><main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 lg:p-8 bg-gradient-to-b from-indigo-50/70 to-slate-100"><div className="max-w-7xl mx-auto space-y-6">{children}</div></main></div></div>;
}
