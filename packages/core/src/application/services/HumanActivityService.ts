import { UnauthorizedError, LockConflictError, LockNotFoundError } from '../../domain/errors/ApplicationErrors.js';
import { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import { TransactionPort } from '../ports/TransactionPort.js';
import { LockService } from './LockService.js';

export interface ActivityLockRef {
  resourceType: string;
  resourceId: string;
}

export interface HumanActivityResult {
  sessionExpiresAt: Date;
  renewedLocks: Array<ActivityLockRef & { expiresAt: Date }>;
}

export class HumanActivityService {
  constructor(
    private readonly sessions: SessionRepositoryPort,
    private readonly locks: LockService,
    private readonly transactions: TransactionPort,
    private readonly sessionIdleTimeoutSeconds: number,
    private readonly lockIdleTimeoutSeconds: number,
  ) {}

  async getStatus(sessionId: string, userId: string): Promise<{ sessionExpiresAt: Date }> {
    const sessionExpiresAt = await this.sessions.getActiveSessionExpiry(sessionId, userId);
    if (!sessionExpiresAt) throw new UnauthorizedError('Session invalid or expired');
    return { sessionExpiresAt };
  }

  async recordActivity(
    sessionId: string,
    userId: string,
    activeLocks: ActivityLockRef[],
  ): Promise<HumanActivityResult> {
    return await this.transactions.runInTransaction(async () => {
      const sessionExpiresAt = new Date(Date.now() + this.sessionIdleTimeoutSeconds * 1000);
      const lockExpiresAt = new Date(Date.now() + this.lockIdleTimeoutSeconds * 1000);
      const touched = await this.sessions.touchSession(sessionId, userId, sessionExpiresAt);
      if (!touched) throw new UnauthorizedError('Session invalid or expired');

      const renewedLocks: HumanActivityResult['renewedLocks'] = [];
      for (const lockRef of activeLocks) {
        try {
          const lock = await this.locks.refreshUntil(
            lockRef.resourceType,
            lockRef.resourceId,
            userId,
            sessionId,
            lockExpiresAt,
          );
          renewedLocks.push({ ...lockRef, expiresAt: lock.expiresAt });
        } catch (error) {
          // A stale or reassigned lock must not prevent genuine activity from
          // renewing the session. The response tells the client it was lost.
          if (error instanceof LockNotFoundError || error instanceof LockConflictError) continue;
          throw error;
        }
      }

      return { sessionExpiresAt, renewedLocks };
    });
  }
}
