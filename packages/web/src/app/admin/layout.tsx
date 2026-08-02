'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LogoutButton } from '../components/ui/LogoutButton';

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
      <aside className="w-72 flex-shrink-0 border-r border-slate-200 bg-white/90 backdrop-blur-xl flex flex-col justify-between z-20">
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
        <header className="h-16 border-b border-slate-200 bg-white/85 backdrop-blur-md px-8 flex items-center justify-between z-10 flex-shrink-0">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-400">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={`${crumb.label}-${idx}`}>
                {idx > 0 && <span className="text-slate-400">/</span>}
                {idx === breadcrumbs.length - 1 || !crumb.href ? (
                  <span className="text-slate-900 font-semibold">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="hover:text-slate-900 transition-colors">
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* Badge Utente Attivo & Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Motore Core Attivo
            </div>
            <div className="h-4 w-px bg-slate-200"></div>
            <div className="flex items-center gap-3">
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
            
            <LogoutButton className="ml-2" />
          </div>
        </header>

        {/* Viewport Contenuto Pagina */}
        <main className="flex-1 overflow-y-auto p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/70 via-slate-50 to-slate-100">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
