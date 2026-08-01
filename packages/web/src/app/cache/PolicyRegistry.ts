export type RetentionClass = 'persistent' | 'sticky' | 'windowed'; 
export type TargetType = 'entity' | 'view';

export interface Lease {
  targetType: TargetType;
  targetId: string;
  ownerId: string;
  retentionClass: RetentionClass;
  acquiredAt: number;
  releasedAt: number | null;
}

export class PolicyRegistryClient {
  private leases: Lease[] = [];

  public retain(targetType: TargetType, targetId: string, ownerId: string, retentionClass: RetentionClass): void {
    const existing = this.leases.find(l => l.targetType === targetType && l.targetId === targetId && l.ownerId === ownerId);
    if (existing) {
      existing.retentionClass = retentionClass;
      existing.acquiredAt = Date.now();
      existing.releasedAt = null;
      return;
    }
    this.leases.push({
      targetType,
      targetId,
      ownerId,
      retentionClass,
      acquiredAt: Date.now(),
      releasedAt: null,
    });
  }

  public release(targetType: TargetType, targetId: string, ownerId: string): void {
    const lease = this.leases.find(
      (item) =>
        item.targetType === targetType &&
        item.targetId === targetId &&
        item.ownerId === ownerId
    );
    if (!lease) return;

    if (lease.retentionClass === 'windowed') {
      lease.releasedAt = Date.now();
      return;
    }

    this.leases = this.leases.filter((item) => item !== lease);
  }

  public releaseAll(ownerId: string): void {
    this.leases = this.leases.filter(l => l.ownerId !== ownerId);
  }

  public purge(): void {
    this.leases = [];
  }

  public removeTarget(targetType: TargetType, targetId: string): void {
    this.leases = this.leases.filter(
      (lease) => lease.targetType !== targetType || lease.targetId !== targetId
    );
  }

  public shouldEvict(targetType: TargetType, targetId: string, windowedTtlMs: number = 5000): boolean {
    const targetLeases = this.leases.filter(l => l.targetType === targetType && l.targetId === targetId);
    
    // No leases, safe to evict
    if (targetLeases.length === 0) return true;

    // A mounted consumer always protects its view, including a windowed one.
    if (targetLeases.some((lease) => lease.releasedAt === null)) return false;

    // Check TTL for windowed leases. If ALL windowed leases are expired, we can evict.
    const now = Date.now();
    const allWindowedExpired = targetLeases.every(l =>
      l.retentionClass === 'windowed' &&
      l.releasedAt !== null &&
      now - l.releasedAt > windowedTtlMs
    );

    return allWindowedExpired;
  }
}

export const GlobalPolicyRegistry = new PolicyRegistryClient();
