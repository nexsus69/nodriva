'use server';

import { signIn, signOut } from '../../auth';
import { AuthError } from 'next-auth';

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof error.digest === 'string' &&
    error.digest.includes('NEXT_REDIRECT')
  );
}

/**
 * Server Action per il login. Delega completamente a NextAuth.
 * NextAuth gestisce internamente:
 * - validazione credenziali (via authorize() in auth.ts)
 * - creazione sessione DB (via AuthApplicationService.login())
 * - generazione e impostazione del cookie JWT
 * - protezione CSRF
 */
export async function loginAction(email: string, password: string) {
  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    return { success: true };
  } catch (err: unknown) {
    // NextAuth lancia AuthError per credenziali invalide
    if (err instanceof AuthError) {
      return { success: false, error: 'Credenziali non valide o utente disabilitato' };
    }
    // NEXT_REDIRECT è un errore "speciale" lanciato da Next.js per i redirect.
    // Se redirect: false non funziona e NextAuth prova a redirezionare,
    // dobbiamo ri-lanciare per non bloccarlo.
    if (isNextRedirect(err)) {
      throw err;
    }
    console.error('Login error:', err);
    return { success: false, error: 'Errore interno del server' };
  }
}

/**
 * Server Action per il logout. Delega a NextAuth signOut().
 * La cancellazione della sessione DB avviene nel callback events.signOut di auth.ts.
 * AppCache.purgeAll() viene chiamato dal client (LogoutButton) dopo questa action.
 */
export async function logoutAction() {
  try {
    await signOut({ redirect: false });
    return { success: true };
  } catch (err: unknown) {
    // Stesso pattern: non bloccare i redirect di Next.js
    if (isNextRedirect(err)) {
      throw err;
    }
    console.error('Logout error:', err);
    return { success: true }; // Consideriamo il logout riuscito comunque
  }
}
