export class AttachmentRateLimiter {
  private readonly events = new Map<string, number[]>();

  consume(actorId: string, limit: number, now = Date.now()): boolean {
    const windowStart = now - 60 * 60 * 1000;
    const recent = (this.events.get(actorId) ?? []).filter((time) => time > windowStart);
    if (recent.length >= limit) {
      this.events.set(actorId, recent);
      return false;
    }
    recent.push(now);
    this.events.set(actorId, recent);
    return true;
  }
}
