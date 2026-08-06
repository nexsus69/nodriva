export class Lock {
  constructor(
    public readonly id: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly acquiredAt: Date,
    public readonly expiresAt: Date
  ) {}

  public isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }
}
