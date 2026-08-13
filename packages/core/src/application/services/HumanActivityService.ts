import { UnauthorizedError, LockConflictError, LockNotFoundError } from '../../domain/errors/ApplicationErrors.js';
import type { SessionRepositoryPort } from '../ports/SessionRepositoryPort.js';
import type { TransactionPort } from '../ports/TransactionPort.js';
import type { LockService } from './LockService.js';
import type { SessionTimingPolicyPort } from '../ports/SessionTimingPolicyPort.js';
import type { ResourceKind } from '../../domain/models/ResourceReference.js';

export interface ActivityLockRef {
  resourceType: ResourceKind;
  resourceId: string;
}

export interface HumanActivityResult {
  sessionExpiresAt: Date;
  renewedLocks: Array<ActivityLockRef & { expiresAt: Date }>;
  timing: Awaited<ReturnType<SessionTimingPolicyPort['getSessionTimingPolicy']>>;
}

export class HumanActivityService {
  constructor(
    private readonly sessions: SessionRepositoryPort,
    private readonly locks: LockService,
    private readonly transactions: TransactionPort,
    private readonly timing: SessionTimingPolicyPort | number,
    private readonly lockIdleTimeoutSeconds?: number,
  ) {}

  async getStatus(sessionId: string, userId: string): Promise<{ sessionExpiresAt: Date; timing: HumanActivityResult['timing'] }> {
    const sessionExpiresAt = await this.sessions.getActiveSessionExpiry(sessionId, userId);
    if (!sessionExpiresAt) throw new UnauthorizedError('Session invalid or expired');
    return { sessionExpiresAt, timing: await this.getPolicy() };
  }

  private async getPolicy() {
    if (typeof this.timing !== 'number') return await this.timing.getSessionTimingPolicy();
    const lockTtlSeconds = this.lockIdleTimeoutSeconds ?? Math.max(1, Math.floor(this.timing / 3));
    return {
      sessionIdleTimeoutSeconds: this.timing,
      sessionUpdateAgeSeconds: Math.max(1, Math.floor(this.timing / 6)),
      lockTtlSeconds,
      syncPollingIntervalSeconds: Math.max(1, Math.floor(this.timing / 6)),
    };
  }

  async recordActivity(
    sessionId: string,
    userId: string,
    activeLocks: ActivityLockRef[],
  ): Promise<HumanActivityResult> {
    return await this.transactions.runInTransaction(async () => {
      const policy = await this.getPolicy();
      const sessionExpiresAt = new Date(Date.now() + policy.sessionIdleTimeoutSeconds * 1000);
      const lockExpiresAt = new Date(Date.now() + policy.lockTtlSeconds * 1000);
      const touched = await this.sessions.touchSession(sessionId, userId, sessionExpiresAt);
      if (!touched) throw new UnauthorizedError('Session invalid or expired');

      const renewedLocks: HumanActivityResult['renewedLocks'] = [];
      for (const lockRef of activeLocks) {
        try {
          const lock = await this.locks.refreshUntil(
            { resourceType: lockRef.resourceType, resourceId: lockRef.resourceId },
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

      return { sessionExpiresAt, renewedLocks, timing: policy };
    });
  }
}
