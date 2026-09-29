/** Configures credentials authentication and preserves safe throttle outcomes across Auth.js. */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authApplicationService, lockService } from './server/db';
import { LoginRateLimitedError } from '@dashboard/core';
import { LoginRateLimitCredentialsError } from './auth/LoginRateLimitCredentialsError';
import { authConfig } from './auth.config';
import { parseLoginCredentials } from './app/actions/auth/authInputValidation';
import { reconcileDatabaseSessionToken } from './server/authSessionToken';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async jwt({ token, user }) {
      return await reconcileDatabaseSessionToken(token, user, authApplicationService);
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
    authorized: authConfig.callbacks?.authorized,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        mfaCode: { label: 'MFA or recovery code', type: 'text' },
      },
      async authorize(credentials, request) {
        const parsedCredentials = parseLoginCredentials(credentials);
        if (!parsedCredentials) {
          return null;
        }

        try {
          const loginResult = await authApplicationService.login(
            parsedCredentials.email,
            parsedCredentials.password,
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
              || request.headers.get('x-real-ip')
              || undefined,
            parsedCredentials.mfaCode,
          );

          const userId = await authApplicationService.resolveSession(loginResult.token);

          return {
            id: userId,
            email: parsedCredentials.email,
            dbToken: loginResult.token,
            dbSessionId: loginResult.sessionId,
          };
        } catch (err: unknown) {
          if (err instanceof LoginRateLimitedError) {
            throw new LoginRateLimitCredentialsError();
          }
          console.error('NextAuth authorize error:', err instanceof Error ? err.message : 'Unknown error');
          return null;
        }
      },
    }),
  ],
  events: {
    async signOut(message) {
      const token = 'token' in message ? message.token?.dbToken : undefined;
      const sessionId = 'token' in message ? message.token?.dbSessionId : undefined;
      if (typeof token === 'string') {
        try {
          if (typeof sessionId === 'string') {
            await lockService.releaseAllForSession(sessionId);
          }
          await authApplicationService.logout(token);
        } catch (err) {
          console.error('NextAuth signOut DB cleanup error:', err);
        }
      }
    },
  },
});
