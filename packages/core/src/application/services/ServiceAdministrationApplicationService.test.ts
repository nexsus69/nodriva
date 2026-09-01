/** Verifies authorization and redaction boundaries for Administration service operations. */
import { describe, expect, it, vi } from 'vitest';
import { ServiceAdministrationApplicationService } from './ServiceAdministrationApplicationService.js';

describe('ServiceAdministrationApplicationService', () => {
  it('requires configuration-read permission before returning sanitized descriptors, health, or recovery evidence', async () => {
    const configuration = { listPublic: vi.fn().mockResolvedValue([{ serviceKey: 'realtime', providerKey: 'disabled' }]) };
    const health = { check: vi.fn().mockResolvedValue({ serviceKey: 'realtime', providerKey: 'disabled', status: 'disabled' }) };
    const access = { assertHasPermission: vi.fn().mockResolvedValue(undefined) };
    const backupStatus = { read: vi.fn().mockResolvedValue({ status: 'completed', restoreVerification: 'passed' }) };
    const service = new ServiceAdministrationApplicationService(configuration as never, health as never, access as never, backupStatus);

    await expect(service.list('actor-1')).resolves.toEqual([{ serviceKey: 'realtime', providerKey: 'disabled' }]);
    await expect(service.checkHealth('actor-1', 'realtime')).resolves.toMatchObject({ status: 'disabled' });
    await expect(service.getBackupStatus('actor-1')).resolves.toMatchObject({ status: 'completed' });
    expect(access.assertHasPermission).toHaveBeenNthCalledWith(1, 'actor-1', 'system.config.read', null);
    expect(access.assertHasPermission).toHaveBeenNthCalledWith(2, 'actor-1', 'system.config.read', null);
    expect(access.assertHasPermission).toHaveBeenNthCalledWith(3, 'actor-1', 'system.config.read', null);
  });

  it('reports unavailable recovery evidence when the deployment has no status adapter', async () => {
    const service = new ServiceAdministrationApplicationService({} as never, {} as never, { assertHasPermission: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(service.getBackupStatus('actor-1')).resolves.toEqual({ status: 'unavailable', code: 'status_not_configured' });
  });
});
