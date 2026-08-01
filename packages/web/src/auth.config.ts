import type { NextAuthConfig } from 'next-auth';
import { NextResponse } from 'next/server';

// Configurazione compatibile con Edge Runtime (usata dal Middleware)
export const authConfig = {
  providers: [], // I provider vanno in auth.ts perché usano il Node runtime (database)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minuti
    updateAge: 5 * 60, // Sliding session: aggiorna se sono passati almeno 5 minuti
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.userId;
      if (!isLoggedIn) {
        // Se c'è un cookie ma non c'è auth (scaduto o corrotto), aggiungiamo l'errore
        const hasCookie = request.cookies.has('authjs.session-token') || request.cookies.has('__Secure-authjs.session-token');
        if (hasCookie) {
          const url = request.nextUrl.clone();
          url.pathname = '/login';
          url.searchParams.set('error', 'SessionExpired');
          url.searchParams.set('callbackUrl', request.nextUrl.pathname);
          return NextResponse.redirect(url);
        }
        return false; // Questo causerà un redirect automatico standard alla pagina signIn
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.dbToken = user.dbToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.userId = String(token.userId);
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
