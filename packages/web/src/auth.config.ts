import type { NextAuthConfig } from 'next-auth';
import { NextResponse } from 'next/server';
import { runtimeTiming } from './config/runtimeTiming';

// Configurazione compatibile con Edge Runtime (usata dal Middleware)
export const authConfig = {
  providers: [], // I provider vanno in auth.ts perché usano il Node runtime (database)
  session: {
    strategy: 'jwt',
    maxAge: runtimeTiming.sessionIdleTimeoutSeconds,
    updateAge: runtimeTiming.sessionUpdateAgeSeconds,
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      // Activity e Sync devono gestire autonomamente la sessione scaduta e
      // restituire JSON/401. Un redirect HTML a /login renderebbe impossibile
      // al client distinguere la scadenza da un errore di rete.
      if (
        request.nextUrl.pathname === '/api/activity'
        || request.nextUrl.pathname === '/api/sync/access'
      ) {
        return true;
      }
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
        token.dbSessionId = user.dbSessionId;
        if (user.email) token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.userId = String(token.userId);
      }
      if (typeof token.dbSessionId === 'string') {
        session.activitySessionId = token.dbSessionId;
      }
      if (typeof token.email === 'string') {
        session.user = { ...session.user, email: token.email };
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
