import { describe, expect, it, vi } from 'vitest';
import { defaultServiceConfigurationRegistry } from '../config/ServiceConfigurationRegistry.js';
import type { ServiceConfigurationRepository, ServiceDeploymentConfigurationSource } from '../ports/ServiceConfigurationRepository.js';
import { ServiceConfigurationService } from './ServiceConfigurationService.js';

function context() {
  const repository: ServiceConfigurationRepository = {
    get: vi.fn().mockResolvedValue(null),
    setRuntimeValues: vi.fn().mockResolvedValue({
      serviceKey: 'realtime', providerKey: 'soketi', values: { enabled: false }, version: 2,
    }),
  };
  const deployment: ServiceDeploymentConfigurationSource = {
    get: vi.fn().mockResolvedValue({
      providerKey: 'soketi',
      values: {
        enabled: true,
        internalHost: 'soketi.internal',
        internalPort: 6001,
        publicHost: 'realtime.example.test',
        publicPort: 443,
        scheme: 'https',
        appKey: 'public-key',
        appSecret: 'secret://realtime/app-secret',
      },
    }),
  };
  const secrets = { resolve: vi.fn().mockResolvedValue('resolved-secret') };
  return { service: new ServiceConfigurationService(defaultServiceConfigurationRegistry, repository, deployment, secrets), repository, deployment, secrets };
}

describe('ServiceConfigurationService', () => {
  it('resolves deployment values and secrets server-side', async () => {
    const { service, secrets } = context();

    await expect(service.get('realtime')).resolves.toMatchObject({
      providerKey: 'soketi',
      values: { internalHost: 'soketi.internal', appSecret: 'resolved-secret' },
    });
    expect(secrets.resolve).toHaveBeenCalledWith('secret://realtime/app-secret');
  });

  it('does not expose secret or deployment-only values in the public view', async () => {
    const { service, secrets } = context();

    await expect(service.getPublic('realtime')).resolves.toEqual({
      serviceKey: 'realtime',
      providerKey: 'soketi',
      values: { enabled: true, appKey: 'public-key' },
      version: 1,
      restartRequired: true,
    });
    expect(secrets.resolve).not.toHaveBeenCalled();
  });

  it('allows runtime values to override deployment values', async () => {
    const { service, repository } = context();
    vi.mocked(repository.get).mockResolvedValue({
      serviceKey: 'realtime', providerKey: 'soketi', values: { enabled: false }, version: 4,
    });

    await expect(service.get('realtime')).resolves.toMatchObject({ version: 4, values: { enabled: false } });
  });

  it('only accepts fields classified as runtime configuration', async () => {
    const { service, repository } = context();

    await expect(service.setRuntimeValues('realtime', 'soketi', { enabled: false }, 1)).resolves.toEqual(expect.anything());
    expect(repository.setRuntimeValues).toHaveBeenCalledWith('realtime', 'soketi', { enabled: false }, 1);
    await expect(service.setRuntimeValues('realtime', 'soketi', { internalHost: 'other' }, 1))
      .rejects.toThrow('not runtime-editable');
  });

  it('rejects unresolved secret references and invalid providers', async () => {
    const { service, deployment, secrets } = context();
    vi.mocked(secrets.resolve).mockResolvedValue(null);
    await expect(service.get('realtime')).rejects.toThrow('could not be resolved');

    vi.mocked(deployment.get).mockResolvedValue({ providerKey: 'unknown', values: {} });
    await expect(service.get('realtime')).rejects.toThrow('not registered');
  });
});
