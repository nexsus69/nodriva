import type { ResourceReference } from './ResourceReference.js';

export class Lock {
  constructor(
    public readonly id: string,
    public readonly resource: ResourceReference,
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly acquiredAt: Date,
    public readonly expiresAt: Date
  ) {}

  get resourceType(): ResourceReference['resourceType'] {
    return this.resource.resourceType;
  }

  get resourceId(): string {
    return this.resource.resourceId;
  }

  public isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }
}
