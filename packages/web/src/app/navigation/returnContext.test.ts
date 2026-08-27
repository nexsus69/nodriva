/** Covers safe, generic origin preservation for routed application flows. */
import { describe, expect, it } from 'vitest';
import { resolveReturnContext, toInternalPath, withReturnContext } from './returnContext';

describe('return context', () => {
  it('preserves an internal origin and its query state', () => {
    expect(withReturnContext('/nodes/child/entities/new', '/nodes/root?tab=children'))
      .toBe('/nodes/child/entities/new?returnTo=%2Fnodes%2Froot%3Ftab%3Dchildren');
  });

  it('rejects external navigation targets and falls back to the local route', () => {
    expect(toInternalPath('https://example.test/steal')).toBeNull();
    expect(toInternalPath('//example.test/steal')).toBeNull();
    expect(resolveReturnContext('https://example.test/steal', '/nodes/root')).toBe('/nodes/root');
  });
});
