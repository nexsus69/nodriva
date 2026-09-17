/** Verifies selective resource-to-window membership without retaining page payloads. */
import { describe, expect, it } from 'vitest';
import { ResourceWindowIndex } from './ResourceWindowIndex';

describe('ResourceWindowIndex', () => {
  it('replaces stale membership before exposing affected windows', () => {
    const index = new ResourceWindowIndex();
    index.replaceWindow('entities:page-1', [{ namespace: 'admin-entity', id: 'a' }, { namespace: 'admin-entity', id: 'b' }]);
    index.replaceWindow('entities:page-2', [{ namespace: 'admin-entity', id: 'b' }]);
    index.replaceWindow('entities:page-1', [{ namespace: 'admin-entity', id: 'c' }]);
    expect(index.windowsFor({ namespace: 'admin-entity', id: 'a' })).toEqual([]);
    expect(index.windowsFor({ namespace: 'admin-entity', id: 'b' })).toEqual(['entities:page-2']);
    expect(index.windowsFor({ namespace: 'admin-entity', id: 'c' })).toEqual(['entities:page-1']);
  });
});
