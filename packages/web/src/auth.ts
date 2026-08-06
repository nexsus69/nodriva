import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authApplicationService } from './server/db';
import { authConfig } from './auth.config';
import { parseLoginCredentials } from './app/actions/auth/authInputValidation';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id && user.dbToken) {
        token.userId = user.id;
        token.dbToken = user.dbToken;
        if (user.email) token.email = user.email;
        return token;
      }

      if (typeof token.dbToken !== 'string') {
        delete token.userId;
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
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.userId = String(token.userId);
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
          const dbToken = await authApplicationService.login(
            parsedCredentials.email,
            parsedCredentials.password,
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
              || request.headers.get('x-real-ip')
              || undefined,
            parsedCredentials.mfaCode,
          );

          const userId = await authApplicationService.resolveSession(dbToken);

          return {
            id: userId,
            email: parsedCredentials.email,
            dbToken,
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
      if (typeof token === 'string') {
        try {
          await authApplicationService.logout(token);
        } catch (err) {
          console.error('NextAuth signOut DB cleanup error:', err);
        }
      }
    },
  },
});
