'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LogoutButton } from '../components/ui/LogoutButton';
import { checkAdminAccessAction } from '../actions/adminAccessActions';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: 'PANORAMICA',
    items: [
      { label: 'Panoramica Admin', href: '/admin', icon: '📊' },
    ],
  },
  {
    groupTitle: 'GESTIONE SCHEMA',
    items: [
      { label: 'Tipi di Nodo ed Entità', href: '/admin/types', icon: '🧱' },
    ],
  },
  {
    groupTitle: 'SICUREZZA & ACCESSI (IAM)',
    items: [
      { label: 'Gestione Utenti', href: '/admin/users', icon: '👥' },
      { label: 'Ruoli e Permessi', href: '/admin/security/roles', icon: '🛡️' },
      { label: 'Assegnazione Scope', href: '/admin/security/scopes', icon: '🔒' },
    ],
  },
  {
    groupTitle: 'GOVERNANCE DI SISTEMA',
    items: [
      { label: 'Capacità Runtime', href: '/admin/system/config', icon: '⚙️' },
      { label: 'Policy di Posizionamento', href: '/admin/system/placement-policies', icon: '💾' },
    ],
  },
  {
    groupTitle: 'AUDIT & COMPLIANCE',
    items: [
      { label: 'Registro di Audit e Log', href: '/admin/audit', icon: '📜' },
      { label: 'Cestino e Ripristino', href: '/admin/recycle-bin', icon: '♻️' },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminAccess, setAdminAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;
    void checkAdminAccessAction().then((allowed) => {
      if (!cancelled) setAdminAccess(allowed ? 'allowed' : 'denied');
    });
    return () => { cancelled = true; };
  }, []);

  if (adminAccess === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">Verifica autorizzazioni…</div>;
  }

  if (adminAccess === 'denied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-semibold">Accesso amministrativo negato</h1>
          <p className="text-sm text-slate-400">Il tuo account non dispone di una capacità amministrativa globale.</p>
          <Link href="/" className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Torna al workspace</Link>
        </div>
      </div>
    );
  }

  const userEmail = session?.user?.email || 'utente@ignoto.com';
  const userInitials = userEmail.substring(0, 2).toUpperCase();

  // Generazione Breadcrumbs dal Pathname
  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    const crumbs: Array<{ label: string; href: string | null }> = [{ label: 'Dashboard', href: '/' }];
    let currentPath = '';

    for (const [index, segment] of segments.entries()) {
      currentPath += `/${segment}`;
      let label = segment.charAt(0).toUpperCase() + segment.slice(1);
      if (segment === 'admin') label = 'Pannello di Amministrazione';
      if (segment === 'types') label = 'Schema Tipi';
      if (segment === 'users') label = 'Utenti';
      if (segment === 'security') label = 'Sicurezza IAM';
      if (segment === 'roles') label = 'Ruoli';
      if (segment === 'scopes') label = 'Scope';
      if (segment === 'system') label = 'Sistema';
      if (segment === 'config') label = 'Capacità Runtime';
      if (segment === 'placement-policies') label = 'Policy di Posizionamento';
      if (segment === 'audit') label = 'Registro Audit';

      // Questi segmenti descrivono una sezione o un parametro dinamico,
      // ma non corrispondono a una pagina raggiungibile autonomamente.
      const isVirtualSection = segment === 'security'
        || segment === 'system'
        || (segments[1] === 'types' && index === 2);

      crumbs.push({ label, href: isVirtualSection ? null : currentPath });
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="admin-page flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* ─── SIDEBAR AMMINISTRATIVA ─────────────────────────────────────── */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Chiudi menu amministrazione"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-shrink-0 -translate-x-full flex-col justify-between border-r border-slate-200 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur-xl transition-transform duration-200 lg:static lg:translate-x-0 lg:shadow-none ${isSidebarOpen ? 'translate-x-0' : ''}`}>
        <div>
          {/* Header Sidebar / Brand */}
          <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                ⚙️
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-wide text-slate-900">
                  Centro di Controllo
                </span>
                <span className="text-[10px] text-indigo-600 font-mono tracking-wider uppercase">
                  Livello Amministrativo V2
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Chiudi menu amministrazione"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden"
            >
              ×
            </button>
          </div>

          {/* Menu Voci di Navigazione */}
          <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-8rem)]">
            {NAV_GROUPS.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1.5">
                <div className="px-3 text-[10px] font-semibold text-slate-500 tracking-wider uppercase font-mono">
                  {group.groupTitle}
                </div>
                {group.items.map((item, iIdx) => {
                  const isActive =
                    item.href === '/admin'
                      ? pathname === '/admin'
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={iIdx}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm shadow-indigo-500/10 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Footer Sidebar: Torna alla Workspace Operativa */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <Link
            href="/"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:text-slate-900 transition-all shadow-sm"
          >
            <span>🌐</span>
            <span>Area Operativa (Workspace)</span>
          </Link>
        </div>
      </aside>

      {/* ─── CORPO PRINCIPALE / WORKSPACE ADMIN ──────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Superiore */}
        <header className="h-16 border-b border-slate-200 bg-white/85 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Apri menu amministrazione"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
            >
              <span aria-hidden="true">☰</span>
            </button>

          {/* Breadcrumb Navigation */}
          <nav className="flex min-w-0 items-center gap-2 overflow-hidden text-xs font-medium text-slate-400">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={`${crumb.label}-${idx}`}>
                {idx > 0 && <span className="text-slate-400">/</span>}
                {idx === breadcrumbs.length - 1 || !crumb.href ? (
                  <span className="truncate text-slate-900 font-semibold">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="hover:text-slate-900 transition-colors">
                    <span className="truncate">{crumb.label}</span>
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
          </div>

          {/* Badge Utente Attivo & Status */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-mono sm:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Motore Core Attivo
            </div>
            <div className="hidden h-4 w-px bg-slate-200 sm:block"></div>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-bold text-xs flex items-center justify-center">
                {status === 'loading' ? '..' : userInitials}
              </div>
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-800">
                  {status === 'loading' ? 'Caricamento...' : userEmail}
                </span>
                <span className="text-[10px] text-indigo-600 font-mono">Utente di Sistema</span>
              </div>
            </div>
            
            <LogoutButton className="ml-0 sm:ml-2" />
          </div>
        </header>

        {/* Viewport Contenuto Pagina */}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 lg:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/70 via-slate-50 to-slate-100">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
