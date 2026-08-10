import { describe, expect, it } from 'vitest';
import { AttachmentRateLimiter } from './AttachmentRateLimiter';

describe('AttachmentRateLimiter', () => {
  it('limits uploads in a rolling hour and expires old events', () => {
    const limiter = new AttachmentRateLimiter();
    expect(limiter.consume('user', 2, 1000)).toBe(true);
    expect(limiter.consume('user', 2, 2000)).toBe(true);
    expect(limiter.consume('user', 2, 3000)).toBe(false);
    expect(limiter.consume('user', 2, 3_601_001)).toBe(true);
  });
});
