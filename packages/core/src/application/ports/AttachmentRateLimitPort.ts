export interface AttachmentRateLimitPort {
  consume(actorId: string, limit: number, now?: Date): Promise<boolean>;
}
