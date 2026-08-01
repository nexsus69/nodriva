import { auth } from '../../../auth';
import { UnauthorizedError } from '@dashboard/core';

/**
 * AuthResolver is the ONLY boundary in the backend for resolving user identity.
 * The client UI must NEVER send actorUserId in payloads.
 * 
 * Usa NextAuth `auth()` per risolvere la sessione dal cookie JWT gestito
 * internamente da NextAuth. Nessun accesso diretto a cookies() o al DB.
 */
export class AuthResolver {
  /**
   * Resolves the current actorUserId from the NextAuth session.
   */
  static async resolveActorUserId(): Promise<string> {
    const session = await auth();
    
    if (!session?.userId) {
      throw new UnauthorizedError('No valid session found');
    }
    
    return session.userId as string;
  }
}
