/** Coordinates administrative access, session context, breadcrumbs, and workspace restoration. */

'use client';

import { createElement, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { checkAdminAccessAction } from '../../actions/adminAccessActions';
import { HomeBreadcrumbIcon } from '../../components/navigation/Breadcrumb';
import { useAdminWorkspaceStore } from '../_state/AdminWorkspaceStore';

const LABELS: Record<string, string> = { admin: 'Pannello di Amministrazione', types: 'Schema Tipi', users: 'Utenti', security: 'Sicurezza IAM', roles: 'Ruoli', scopes: 'Ambiti', system: 'Sistema', config: 'Capacità Runtime', 'placement-policies': 'Policy di Posizionamento', audit: 'Registro Audit' };

export function useAdminShell() {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const setUserContext = useAdminWorkspaceStore((state) => state.setUserContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied' | 'unavailable'>('checking');
  const [accessAttempt, setAccessAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void checkAdminAccessAction()
      .then((allowed) => { if (!cancelled) setAccess(allowed ? 'allowed' : 'denied'); })
      .catch(() => { if (!cancelled) setAccess('unavailable'); });
    return () => { cancelled = true; };
  }, [accessAttempt]);
  const retryAccess = () => {
    setAccess('checking');
    setAccessAttempt((attempt) => attempt + 1);
  };
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    const userId = session?.user && 'id' in session.user && typeof session.user.id === 'string' ? session.user.id : session?.user?.email ?? null;
    setUserContext(userId);
  }, [session?.user, sessionStatus, setUserContext]);
  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    return [{ label: 'Dashboard', href: '/', icon: createElement(HomeBreadcrumbIcon) }, ...segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      const virtual = segment === 'security' || segment === 'system' || (segments[1] === 'types' && index === 2);
      return { label: LABELS[segment] ?? `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`, href: virtual ? null : path };
    })];
  }, [pathname]);
  const email = session?.user?.email || 'utente@ignoto.com';
  return { pathname, access, retryAccess, sidebarOpen, setSidebarOpen, breadcrumbs, email, initials: email.substring(0, 2).toUpperCase(), sessionStatus };
}
