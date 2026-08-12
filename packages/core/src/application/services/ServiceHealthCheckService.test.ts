import { describe, expect, it, vi } from 'vitest';
import { DefaultServiceHealthCheckRegistry, type ServiceHealthCheckRegistry, type ServiceHealthCheckPort } from '../ports/ServiceHealthCheckPort.js';
import { ServiceHealthCheckService } from './ServiceHealthCheckService.js';
import type { ServiceConfigurationService } from './ServiceConfigurationService.js';

describe('ServiceHealthCheckService', () => {
  it('rejects duplicate provider checkers', () => {
    const registry = new DefaultServiceHealthCheckRegistry();
    const checker: ServiceHealthCheckPort = { check: vi.fn() };
    registry.register('realtime', 'soketi', checker);
    expect(() => registry.register('realtime', 'soketi', checker)).toThrow('already registered');
  });

  it('runs the checker selected by the effective provider', async () => {
    const checker: ServiceHealthCheckPort = { check: vi.fn().mockResolvedValue({
      serviceKey: 'realtime', providerKey: 'soketi', status: 'healthy', checkedAt: new Date(),
    }) };
    const registry: ServiceHealthCheckRegistry = { register: vi.fn(), get: vi.fn().mockReturnValue(checker) };
    const configuration = { get: vi.fn().mockResolvedValue({ providerKey: 'soketi', values: { host: 'soketi' } }) } as unknown as ServiceConfigurationService;
    const service = new ServiceHealthCheckService(configuration, registry);

    await expect(service.check('realtime')).resolves.toMatchObject({ status: 'healthy', providerKey: 'soketi' });
    expect(checker.check).toHaveBeenCalledWith('realtime', 'soketi', { host: 'soketi' });
  });

  it('returns an explicit status when no checker is registered', async () => {
    const registry: ServiceHealthCheckRegistry = { register: vi.fn(), get: vi.fn().mockReturnValue(null) };
    const configuration = { get: vi.fn().mockResolvedValue({ providerKey: 'sqlite', values: {} }) } as unknown as ServiceConfigurationService;

    await expect(new ServiceHealthCheckService(configuration, registry).check('database'))
      .resolves.toMatchObject({ status: 'not-configured', message: expect.stringContaining('No healthcheck') });
  });
});
