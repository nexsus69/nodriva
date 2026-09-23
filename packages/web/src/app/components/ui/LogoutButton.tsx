'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { logoutAction } from '../../actions/authActions';
import { AppCache } from '../../cache/GlobalCacheClient';
import { useHumanActivity } from '../../activity/ActivityProvider';
import { useNavigationConfirmation } from '../../navigation/NavigationBlocker';
import { useAppLocale } from '../../i18n/AppLocaleStore';

interface LogoutButtonProps {
  className?: string;
}

/** Shared logout lifecycle for every surface that offers a session exit. */
export function useLogout() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const { update: refreshSession } = useSession();
  const { resetActivity } = useHumanActivity();
  const confirmNavigation = useNavigationConfirmation();

  const logout = async () => {
    if (!(await confirmNavigation())) return;
    setIsLoggingOut(true);
    try {
      // Ferma immediatamente timer e polling, prima che il cookie venga
      // rimosso e prima che useSession aggiorni lo snapshot.
      resetActivity();
      // 1. Invoca la Server Action per cancellare il cookie HTTP-Only e invalidare su DB
      const res = await logoutAction();
      
      // 2. Anche se la chiamata API fallisce parzialmente (es. rete persa),
      // dobbiamo obbligatoriamente spurgare la memoria locale come cintura di sicurezza
      AppCache.purgeAll();

      if (res.success) {
        // Aggiorna lo snapshot client prima della navigazione, altrimenti il
        // SessionProvider può mostrare per un attimo l'utente precedente.
        await refreshSession();
        router.replace('/login');
        router.refresh();
      } else {
        // Fallback: se success è falso per qualche motivo, forziamo un window reload 
        // per far scattare il middleware che farà redirect in base all'assenza del cookie
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- The server session outcome is uncertain, so discard the client runtime.
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Errore fatale durante il logout:', err);
      // Purge difensivo in caso di eccezione imprevista
      AppCache.purgeAll();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- The server session outcome is uncertain, so discard the client runtime.
      window.location.href = '/login';
    } finally {
      setIsLoggingOut(false);
    }
  };

  return { logout, isLoggingOut };
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const { logout, isLoggingOut } = useLogout();
  const { t } = useAppLocale();
  return (
    <button
      onClick={logout}
      disabled={isLoggingOut}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all flex items-center gap-2 ${className || ''}`}
      title={t('account.logout')}
    >
      <span>{isLoggingOut ? '🔄' : '🚪'}</span>
      <span>{isLoggingOut ? t('account.loggingOut') : t('account.logout')}</span>
    </button>
  );
}
