'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { logoutAction } from '../../actions/authActions';
import { AppCache } from '../../cache/GlobalCacheClient';

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const { update: refreshSession } = useSession();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
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
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Errore fatale durante il logout:', err);
      // Purge difensivo in caso di eccezione imprevista
      AppCache.purgeAll();
      window.location.href = '/login';
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all flex items-center gap-2 ${className || ''}`}
      title="Disconnetti"
    >
      <span>{isLoggingOut ? '🔄' : '🚪'}</span>
      <span>Logout</span>
    </button>
  );
}
