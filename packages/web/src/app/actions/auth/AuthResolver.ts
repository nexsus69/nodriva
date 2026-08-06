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
  static async resolveActorIdentity(): Promise<{ userId: string; sessionId: string }> {
    const session = await auth();
    if (!session?.userId || !session.activitySessionId) {
      throw new UnauthorizedError('No valid session found');
    }
    return {
      userId: session.userId,
      sessionId: session.activitySessionId,
    };
  }

  /**
   * Resolves the current actorUserId from the NextAuth session.
   */
  static async resolveActorUserId(): Promise<string> {
    return (await this.resolveActorIdentity()).userId;
  }
}
