import { describe, expect, it, vi } from 'vitest';
import { ServiceAdministrationApplicationService } from './ServiceAdministrationApplicationService.js';

describe('ServiceAdministrationApplicationService', () => {
  it('requires configuration-read permission before returning sanitized descriptors or health', async () => {
    const configuration = { listPublic: vi.fn().mockResolvedValue([{ serviceKey: 'realtime', providerKey: 'disabled' }]) };
    const health = { check: vi.fn().mockResolvedValue({ serviceKey: 'realtime', providerKey: 'disabled', status: 'disabled' }) };
    const access = { assertHasPermission: vi.fn().mockResolvedValue(undefined) };
    const service = new ServiceAdministrationApplicationService(configuration as never, health as never, access as never);

    await expect(service.list('actor-1')).resolves.toEqual([{ serviceKey: 'realtime', providerKey: 'disabled' }]);
    await expect(service.checkHealth('actor-1', 'realtime')).resolves.toMatchObject({ status: 'disabled' });
    expect(access.assertHasPermission).toHaveBeenNthCalledWith(1, 'actor-1', 'system.config.read', null);
    expect(access.assertHasPermission).toHaveBeenNthCalledWith(2, 'actor-1', 'system.config.read', null);
  });
});
