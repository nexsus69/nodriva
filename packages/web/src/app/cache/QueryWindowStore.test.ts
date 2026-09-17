/** Verifies bounded window retention and synchronized reverse resource indexing. */
import { describe, expect, it } from 'vitest';
import { QueryWindowStore } from './QueryWindowStore';
import { ResourceWindowIndex } from './ResourceWindowIndex';

const window = (key: string, id: string) => ({ key, descriptor: { query: 'entities' }, references: [{ namespace: 'admin-entity', id }], page: 1, pageCount: 2, total: 30 });
describe('QueryWindowStore', () => {
  it('evicts the least recently used window and removes its resource membership', () => {
    const index = new ResourceWindowIndex();
    const store = new QueryWindowStore(index, 2);
    store.put(window('entities:1', 'a'));
    store.put(window('entities:2', 'b'));
    store.get('entities:1');
    store.put(window('entities:3', 'c'));
    expect(store.get('entities:2')).toBeNull();
    expect(index.windowsFor({ namespace: 'admin-entity', id: 'b' })).toEqual([]);
    expect(index.windowsFor({ namespace: 'admin-entity', id: 'a' })).toEqual(['entities:1']);
  });
});
