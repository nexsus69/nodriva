import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authApplicationService, lockService } from './server/db';
import { authConfig } from './auth.config';
import { parseLoginCredentials } from './app/actions/auth/authInputValidation';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id && user.dbToken) {
        token.userId = user.id;
        token.dbToken = user.dbToken;
        token.dbSessionId = user.dbSessionId;
        if (user.email) token.email = user.email;
        return token;
      }

      if (typeof token.dbToken !== 'string') {
        delete token.userId;
        delete token.dbSessionId;
        return token;
      }

      try {
        const resolvedUserId = await authApplicationService.resolveSession(token.dbToken);
        token.userId = resolvedUserId;
        const currentUser = await authApplicationService.getUserById(resolvedUserId);
        if (!currentUser) throw new Error('Authenticated user no longer exists');
        token.email = currentUser.email;
      } catch {
        delete token.userId;
        delete token.dbToken;
        delete token.dbSessionId;
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
