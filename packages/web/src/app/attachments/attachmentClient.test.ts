/** Verifies attachment HTTP concurrency tokens, cache reconciliation and expired sessions. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteResourceAttachment, uploadResourceAttachment } from './attachmentClient';
import { AppCache } from '../cache/GlobalCacheClient';

vi.mock('../cache/GlobalCacheClient', () => {
  const cache = { get: vi.fn(), inject: vi.fn() };
  return { AppCache: {
    nodes: cache, getEntityCache: vi.fn(() => cache), purgeAll: vi.fn(), notifyAttachmentCollectionChanged: vi.fn(),
    mutations: { run: async (_key: string, work: (mutationId: string) => Promise<unknown>, accept: (value: unknown) => void) => { const result = await work('mutation-test'); accept(result); return result; } },
  } };
});

describe('attachmentClient', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('sends upload version and accepts the authoritative resource before invalidation', async () => {
    const resource = { id: 'node', rowVersion: 8 };
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: 'attachment', rowVersion: 8, resource }));
    await expect(uploadResourceAttachment({ resourceType: 'node', resourceId: 'node', fieldKey: 'file', kind: 'file', file: new File(['test'], 'test.txt'), expectedRowVersion: 7 })).resolves.toMatchObject({ rowVersion: 8 });
    const request = vi.mocked(fetch).mock.calls[0]![1]!;
    expect((request.body as FormData).get('expectedRowVersion')).toBe('7');
    expect(request.headers).toEqual({ 'X-Mutation-Id': 'mutation-test' });
    expect(AppCache.nodes.inject).toHaveBeenCalledWith('node', resource);
    expect(AppCache.notifyAttachmentCollectionChanged).toHaveBeenCalledOnce();
  });

  it('sends If-Match for deletion and never overwrites a newer cached resource', async () => {
    vi.mocked(AppCache.nodes.get).mockReturnValue({ id: 'node', rowVersion: 10 } as never);
    vi.mocked(fetch).mockResolvedValue(Response.json({ rowVersion: 8, resource: { id: 'node', rowVersion: 8 } }));
    await expect(deleteResourceAttachment({ id: 'attachment', resourceType: 'node', resourceId: 'node', expectedRowVersion: 7 })).resolves.toBe(8);
    expect(fetch).toHaveBeenCalledWith('/api/attachments/attachment', { method: 'DELETE', headers: { 'If-Match': '7', 'X-Mutation-Id': 'mutation-test' } });
    expect(AppCache.nodes.inject).not.toHaveBeenCalled();
  });

  it('purges expired identity data and preserves the semantic failure code', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: 'AUTH_UNAUTHORIZED' }, { status: 401 }));
    await expect(deleteResourceAttachment({ id: 'attachment', resourceType: 'node', resourceId: 'node', expectedRowVersion: 7 })).rejects.toMatchObject({ code: 'AUTH_UNAUTHORIZED' });
    expect(AppCache.purgeAll).toHaveBeenCalledOnce();
    expect(AppCache.notifyAttachmentCollectionChanged).not.toHaveBeenCalled();
  });
});
