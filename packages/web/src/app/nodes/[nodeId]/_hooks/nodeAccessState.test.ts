import { describe, expect, it } from 'vitest';
import { resolveNodeAccess } from './nodeAccessState';

describe('resolveNodeAccess', () => {
  it('keeps an explicit authorization denial distinct', async () => {
    await expect(resolveNodeAccess(async () => false)).resolves.toBe('denied');
  });

  it('reports an unexpected check failure as unavailable', async () => {
    await expect(resolveNodeAccess(async () => { throw new Error('database unavailable'); }))
      .resolves.toBe('unavailable');
  });

  it('allows a successful check', async () => {
    await expect(resolveNodeAccess(async () => true)).resolves.toBe('allowed');
  });
});
