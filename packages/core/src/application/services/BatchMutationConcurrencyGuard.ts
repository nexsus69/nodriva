/** Applies the shared interactive-lock policy to relationship batch operations. */

import type { TypeDomain } from '../dto/TypeFieldDefinition.js';
import type { RuntimeConfigurationPort } from '../ports/RuntimeConfigurationPort.js';
import type { LockService } from './LockService.js';

/** A source resource examined before a relationship batch is committed. */
export interface BatchMutationResource {
  domain: TypeDomain;
  resourceId: string;
}

/** Lock state exposed to the planner without leaking lock-owner identities. */
export interface BatchMutationLockState extends BatchMutationResource {
  available: boolean;
}

/**
 * Applies the explicit concurrency policy used by inverse batch mutations.
 *
 * It does not create long-lived locks. Durable row-version checks and the
 * database transaction remain the authoritative final concurrency boundary.
 */
export class BatchMutationConcurrencyGuard {
  constructor(
    private readonly lockService: Pick<LockService, 'isLocked' | 'requireLockIfNeeded'>,
    private readonly runtimeConfigPort: RuntimeConfigurationPort,
  ) {}

  async inspect(
    resources: readonly BatchMutationResource[],
    actorUserId: string,
    actorSessionId: string,
  ): Promise<BatchMutationLockState[]> {
    if (!(await this.runtimeConfigPort.isCapabilityEnabled('locking'))) {
      return resources.map((resource) => ({ ...resource, available: true }));
    }

    return Promise.all(resources.map(async (resource) => {
      const lock = await this.lockService.isLocked({
        resourceType: resource.domain,
        resourceId: resource.resourceId,
      });
      const ownedByActorSession = lock.byUserId === actorUserId && lock.bySessionId === actorSessionId;
      return { ...resource, available: !lock.locked || ownedByActorSession };
    }));
  }

  async assertAvailable(
    resources: readonly BatchMutationResource[],
    actorUserId: string,
    actorSessionId: string,
  ): Promise<void> {
    if (!(await this.runtimeConfigPort.isCapabilityEnabled('locking'))) return;

    for (const resource of resources) {
      await this.lockService.requireLockIfNeeded(
        { resourceType: resource.domain, resourceId: resource.resourceId },
        actorUserId,
        actorSessionId,
      );
    }
  }
}
