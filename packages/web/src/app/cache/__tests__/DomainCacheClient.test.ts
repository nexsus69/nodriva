import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainCacheClient } from '../DomainCacheClient';

interface TestItem {
  id: string;
  name: string;
  rowVersion?: number;
  payload?: Record<string, unknown>;
}

describe('DomainCacheClient', () => {
  let fetcherMock: ReturnType<typeof vi.fn>;
  let client: DomainCacheClient<TestItem>;

  beforeEach(() => {
    fetcherMock = vi.fn();
    client = new DomainCacheClient<TestItem>(
      'test',
      (id) => fetcherMock(id) as Promise<TestItem>
    );
  });

  it('should initialize entry with refCount 1 on retain', () => {
    client.retain('1');
    expect(client.get('1')).toBeNull(); // It initializes with null data, waiting for fetch
    // We can't access private fields directly, but we know it doesn't throw.
  });

  it('should NOT GC immediately when release brings refCount to 0 (to support virtual lists)', () => {
    client.retain('1');
    client.inject('1', { id: '1', name: 'Test' }, false);
    
    expect(client.get('1')).toEqual({ id: '1', name: 'Test' });

    client.release('1');
    
    // Should NOT be garbage collected immediately
    expect(client.get('1')).toEqual({ id: '1', name: 'Test' });
  });

  it('should not GC if refCount is still > 0', () => {
    client.retain('1'); // ref 1
    client.retain('1'); // ref 2
    client.inject('1', { id: '1', name: 'Test' }, false);
    
    client.release('1'); // ref 1
    expect(client.get('1')).toEqual({ id: '1', name: 'Test' });
  });

  it('should implement Promise deduplication', async () => {
    // Setup fetcher to take some time
    fetcherMock.mockImplementation((id: string) => 
      new Promise(resolve => setTimeout(() => resolve({ id, name: 'Fetched' }), 50))
    );

    client.retain('1');
    
    // Call fetch 3 times concurrently
    const p1 = client.fetchIfMissing('1');
    const p2 = client.fetchIfMissing('1');
    const p3 = client.fetchIfMissing('1');

    expect(p1).toBe(p2);
    expect(p2).toBe(p3);

    const res = await p1;
    expect(res).toEqual({ id: '1', name: 'Fetched' });
    
    // fetcher should only be called once!
    expect(fetcherMock).toHaveBeenCalledTimes(1);
  });

  it('should handle partial caching and hydration', async () => {
    client.retain('1');
    
    // Inject partial data (like from a table list)
    client.inject('1', { id: '1', name: 'Partial Name' }, true);
    
    expect(client.get('1')).toEqual({ id: '1', name: 'Partial Name' });
    expect(client.needsFetch('1', false)).toBe(false); // Doesn't need fetch if we don't require complete
    expect(client.needsFetch('1', true)).toBe(true); // Needs fetch if we require complete!

    // Setup full fetcher
    fetcherMock.mockResolvedValue({ id: '1', name: 'Full Name', payload: { details: 'yes' } });

    // Request full data
    const fullData = await client.fetchIfMissing('1', true);
    
    expect(fetcherMock).toHaveBeenCalledTimes(1);
    expect(fullData).toEqual({ id: '1', name: 'Full Name', payload: { details: 'yes' } });
    
    // The cache is now merged and no longer partial
    expect(client.get('1')).toEqual({ id: '1', name: 'Full Name', payload: { details: 'yes' } });
    expect(client.needsFetch('1', true)).toBe(false); // No longer needs fetch
  });

  it('should notify subscribers on mutation', () => {
    client.retain('1');
    client.inject('1', { id: '1', name: 'A' });

    const subscriber = vi.fn();
    const unsubscribe = client.subscribe('1', subscriber);

    client.mutate('1', { name: 'B' });
    
    expect(subscriber).toHaveBeenCalledWith({ id: '1', name: 'B' }, null);
    
    unsubscribe();
    client.mutate('1', { name: 'C' });
    
    // Should not be called again
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('keeps subscriptions registered before the first cache injection', () => {
    const firstConsumer = vi.fn();
    const secondConsumer = vi.fn();

    client.subscribe('1', firstConsumer);
    client.subscribe('1', secondConsumer);
    client.inject('1', { id: '1', name: 'Created later' }, false);

    expect(firstConsumer).toHaveBeenCalledWith(
      { id: '1', name: 'Created later' },
      null
    );
    expect(secondConsumer).toHaveBeenCalledWith(
      { id: '1', name: 'Created later' },
      null
    );
  });

  it('updates every subscriber with the same canonical merged value', () => {
    client.inject('1', { id: '1', name: 'Before', payload: { stable: true } }, false);
    const firstConsumer = vi.fn();
    const secondConsumer = vi.fn();
    client.subscribe('1', firstConsumer);
    client.subscribe('1', secondConsumer);

    client.inject('1', { id: '1', name: 'After' }, false);

    const expected = {
      id: '1',
      name: 'After',
      payload: { stable: true },
    };
    expect(client.get('1')).toEqual(expected);
    expect(firstConsumer).toHaveBeenLastCalledWith(expected, null);
    expect(secondConsumer).toHaveBeenLastCalledWith(expected, null);
  });

  it('notifies the domain-level observer for every canonical change', () => {
    const domainObserver = vi.fn();
    client = new DomainCacheClient<TestItem>(
      'test',
      (id) => fetcherMock(id) as Promise<TestItem>,
      domainObserver
    );

    client.inject('1', { id: '1', name: 'A' }, false);
    client.mutate('1', { name: 'B' });
    client.remove('1');

    expect(domainObserver).toHaveBeenCalledTimes(3);
  });

  it('ignores a stale response that arrives after a newer mutation', () => {
    const subscriber = vi.fn();
    client.subscribe('1', subscriber);
    client.inject('1', { id: '1', name: 'New name', rowVersion: 2 }, false);
    subscriber.mockClear();

    client.inject('1', { id: '1', name: 'Old name', rowVersion: 1 }, false);

    expect(client.get('1')).toEqual({
      id: '1',
      name: 'New name',
      rowVersion: 2,
    });
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('does not let an unversioned partial projection overwrite newer fields', () => {
    client.inject('1', { id: '1', name: 'New name', rowVersion: 2 }, false);

    client.inject('1', { id: '1', name: 'Unknown-age name' }, true);

    expect(client.get('1')).toEqual({
      id: '1',
      name: 'New name',
      rowVersion: 2,
    });
  });

  it('should broadcast errors to subscribers when fetch fails', async () => {
    client.retain('1');
    
    const errorMsg = 'Network Error 500';
    fetcherMock.mockRejectedValue(new Error(errorMsg));

    const subscriber = vi.fn();
    client.subscribe('1', subscriber);

    // Aspettiamo che la fetch fallisca
    await expect(client.fetchIfMissing('1')).rejects.toThrow(errorMsg);

    // Il subscriber deve essere stato chiamato con null per i dati e con l'errore per il secondo parametro
    expect(subscriber).toHaveBeenCalledWith(null, new Error(errorMsg));
    
    // Lo stato della cache deve contenere l'errore
    expect(client.getError('1')).toEqual(new Error(errorMsg));
    
    // Assicuriamoci che la promise in pending sia stata ripulita
    expect(client.isFetchPending('1')).toBe(false);
  });
});
