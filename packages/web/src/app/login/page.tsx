'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense } from 'react';
import { loginAction } from '../actions/authActions';
import { AppCache } from '../cache/GlobalCacheClient';

function SessionWarning() {
  const searchParams = useSearchParams();
  if (searchParams.get('error') === 'SessionExpired') {
    return (
      <div
        role="status"
        className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-medium leading-5 text-amber-50"
      >
        <span aria-hidden="true" className="mt-0.5 text-amber-300">⚠</span>
        <span>La tua sessione è scaduta per inattività. Effettua nuovamente l&apos;accesso.</span>
      </div>
    );
  }
  return null;
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { update: refreshSession } = useSession();

  // Cintura di Sicurezza Difensiva: Se l'utente arriva sulla pagina di login,
  // garantiamo che non ci siano dati in memoria di un'altra sessione.
  useEffect(() => {
    AppCache.purgeAll();
  }, []);

  const handleAction = async (formData: FormData) => {
    if (isLoading) return;
    
    setError('');
    setIsLoading(true);

    try {
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      const mfaCode = formData.get('mfaCode') as string;

      const res = await loginAction(email, password, mfaCode);
      if (res.success) {
        // La Server Action ha già scritto il cookie lato server. Il render
        // successivo rilegge la sessione autorevole senza rendere obbligatoria
        // una seconda chiamata client a /api/auth/session.
        AppCache.purgeAll();
        try {
          await refreshSession();
        } catch (sessionError) {
          // Un fallimento transitorio del refresh non annulla un login già
          // completato. router.refresh() aggiornerà il layout dal server.
          console.warn('Session refresh after login failed; using server render:', sessionError);
        }
        router.replace('/');
        router.refresh();
      } else {
        setError(res.error || 'Errore durante il login');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      console.error('Login exception:', err);
      setError('Errore di connessione o errore interno');
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7fb] text-slate-900">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-indigo-300/25 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-violet-200/35 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(71,85,105,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(71,85,105,.8)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-2xl shadow-slate-300/50 backdrop-blur-2xl lg:grid-cols-[1.05fr_.95fr]">
          <section className="relative hidden min-h-[680px] flex-col justify-between overflow-hidden border-r border-indigo-400/20 bg-gradient-to-br from-indigo-500 via-indigo-600 to-[#312e81] p-10 lg:flex xl:p-14">
            <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[36px] border-white/15" />
            <div aria-hidden="true" className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full border-[44px] border-violet-200/15" />

            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 shadow-lg shadow-indigo-950/20 ring-1 ring-white/20">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white" aria-hidden="true">
                    <path d="M5 19V9.5L12 5l7 4.5V19M8.5 19v-5h7v5M3.5 9.5 12 4l8.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-sm font-semibold tracking-[0.18em] text-indigo-100">DASHBOARD ULTIMATE</span>
              </div>

              <div className="mt-28 max-w-md">
                <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-indigo-200">Workspace intelligente</p>
                <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white xl:text-5xl">
                  Tutto il tuo lavoro, in un unico spazio.
                </h1>
                <p className="mt-6 max-w-sm text-base leading-7 text-indigo-100/75">
                  Gestisci gerarchie, entità e configurazioni con una piattaforma pensata per restare chiara anche quando il sistema cresce.
                </p>
              </div>
            </div>

            <div className="relative grid grid-cols-3 gap-3 border-t border-white/15 pt-6 text-xs text-indigo-100/70">
              <div><p className="mb-1 text-lg font-semibold text-white">01</p><p>Controllo</p></div>
              <div><p className="mb-1 text-lg font-semibold text-white">02</p><p>Collaborazione</p></div>
              <div><p className="mb-1 text-lg font-semibold text-white">03</p><p>Governance</p></div>
            </div>
          </section>

          <section className="flex min-h-[680px] flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:px-12 xl:px-16">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-10 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/25">
                    <span className="text-lg font-bold text-white">D</span>
                  </div>
                  <span className="text-sm font-semibold tracking-[0.16em] text-slate-200">DASHBOARD ULTIMATE</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-indigo-400">Bentornato</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Accedi al tuo spazio</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">Inserisci le tue credenziali per continuare.</p>
              </div>

              <Suspense fallback={null}>
                <SessionWarning />
              </Suspense>

              <form className="mt-8 space-y-5" action={handleAction}>
                <div>
                  <label htmlFor="email-address" className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                  <div className="relative">
                    <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true">
                      <path d="m4 6 8 6 8-6M5 19h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <input id="email-address" name="email" type="email" autoComplete="email" required placeholder="nome@azienda.it" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" />
                  </div>
                </div>

                <div>
                  <label htmlFor="mfa-code" className="mb-2 block text-xs font-semibold text-slate-700">
                    Codice MFA <span className="font-normal text-slate-400">(se configurato)</span>
                  </label>
                  <input id="mfa-code" name="mfaCode" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="Codice TOTP o di recupero" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                  </div>
                  <div className="relative">
                    <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true">
                      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Inserisci la password" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" />
                  </div>
                </div>

                {error && (
                  <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-5 text-rose-200">
                    <span aria-hidden="true" className="mt-0.5 text-rose-300">!</span>
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 hover:shadow-indigo-500/30 focus:outline-none focus:ring-4 focus:ring-indigo-500/25 disabled:cursor-not-allowed disabled:bg-indigo-500/50 disabled:shadow-none">
                  {isLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                      Accesso in corso...
                    </>
                  ) : (
                    <>
                      Accedi
                      <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-10 text-center text-xs leading-5 text-slate-400">Accesso protetto · Dashboard Ultimate V2</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
