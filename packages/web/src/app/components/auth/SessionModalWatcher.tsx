'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface SessionModalWatcherProps {
  initialExpires?: string;
}

export function SessionModalWatcher({ initialExpires }: SessionModalWatcherProps) {
  const [isExpired, setIsExpired] = useState(false);
  const pathname = usePathname();
  
  useEffect(() => {
    // Timeout relativo: 30 minuti
    // Questo aggira qualsiasi problema di fuso orario o orologi non sincronizzati!
    const MAX_AGE_MS = 30 * 60 * 1000;
    const SAFETY_BUFFER = 1000;

    let isCancelled = false;

    const timeoutId = setTimeout(async () => {
      if (isCancelled) return;
      console.log(`[SessionWatcher] Timer fired! Checking session...`);
      
      try {
        const res = await fetch('/api/auth/session');
        const session = await res.json();
        
        if (!session || Object.keys(session).length === 0 || !session.expires) {
          console.log(`[SessionWatcher] Session expired, showing modal.`);
          if (!isCancelled) setIsExpired(true);
        } else {
          // Se il server dice che è ancora valida (magari c'è stata una Server Action 
          // che non ha cambiato il pathname), dovremmo aggiornare il timer, ma per 
          // ora aspettiamo che scada veramente.
          console.log(`[SessionWatcher] Session was silently extended on server.`);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        if (!isCancelled) setIsExpired(true);
      }
    }, MAX_AGE_MS + SAFETY_BUFFER);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [pathname]); // Il timer riparte da zero ogni volta che cambi pagina!

  if (!isExpired) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-xl shadow-2xl max-w-sm w-full text-center space-y-6">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-900/50 text-red-500">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-medium text-white mb-2">Sessione Scaduta</h3>
          <p className="text-sm text-slate-400">
            Per motivi di sicurezza, la tua sessione è stata interrotta per inattività.
          </p>
        </div>
        <button
          onClick={() => {
            window.location.href = '/login?error=SessionExpired';
          }}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Accedi di nuovo
        </button>
      </div>
    </div>
  );
}
