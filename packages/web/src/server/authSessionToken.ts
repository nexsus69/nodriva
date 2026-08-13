import { AppError } from '@dashboard/core';
import type { User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

export interface DatabaseSessionIdentityService {
  resolveSession(token: string): Promise<string>;
  getUserById(userId: string): Promise<{ email: string } | null>;
}

function withoutDatabaseIdentity(token: JWT): JWT {
  const next = { ...token };
  delete next.userId;
  delete next.dbToken;
  delete next.dbSessionId;
  return next;
}

/**
 * Reconciles signed Auth.js claims with the authoritative database session.
 * Only an explicit authentication denial invalidates the token. Temporary
 * infrastructure failures retain the previous signed claims so a later
 * request can retry without logging the user out prematurely.
 */
export async function reconcileDatabaseSessionToken(
  token: JWT,
  user: User | undefined,
  sessions: DatabaseSessionIdentityService,
  reportInfrastructureFailure: (error: unknown) => void = (error) => {
    console.error('[Auth] Database session verification unavailable:', error);
  },
): Promise<JWT> {
  if (user?.id && user.dbToken) {
    return {
      ...token,
      userId: user.id,
      dbToken: user.dbToken,
      dbSessionId: user.dbSessionId,
      ...(user.email ? { email: user.email } : {}),
    };
  }

  if (typeof token.dbToken !== 'string') return withoutDatabaseIdentity(token);

  try {
    const resolvedUserId = await sessions.resolveSession(token.dbToken);
    const currentUser = await sessions.getUserById(resolvedUserId);
    if (!currentUser) return withoutDatabaseIdentity(token);
    return { ...token, userId: resolvedUserId, email: currentUser.email };
  } catch (error) {
    if (error instanceof AppError && error.code === 'AUTH_UNAUTHORIZED') {
      return withoutDatabaseIdentity(token);
    }
    reportInfrastructureFailure(error);
    return token;
  }
}
