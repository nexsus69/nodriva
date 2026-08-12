import { describe, expect, it } from 'vitest';
import {
  defaultServiceConfigurationRegistry,
  ServiceConfigurationRegistry,
} from './ServiceConfigurationRegistry.js';

describe('ServiceConfigurationRegistry', () => {
  it('registers the infrastructure service contract without storing values', () => {
    const services = defaultServiceConfigurationRegistry.list();

    expect(services.map((service) => service.key)).toEqual([
      'database', 'realtime', 'attachment-storage', 'antivirus', 'mail', 'backup', 'observability', 'security-keys',
    ]);
    expect(defaultServiceConfigurationRegistry.get('database').providers.map((provider) => provider.key))
      .toEqual(['postgres', 'sqlite']);
    expect(defaultServiceConfigurationRegistry.get('realtime').providers[0]?.fields)
      .toEqual(expect.arrayContaining([expect.objectContaining({ key: 'internalHost', source: 'deployment' })]));
  });

  it('rejects duplicate services and providers', () => {
    const registry = new ServiceConfigurationRegistry();
    const definition = { key: 'mail' as const, displayName: 'Mail', providers: [{ key: 'smtp', displayName: 'SMTP', fields: [] }] };

    registry.register(definition);
    expect(() => registry.register(definition)).toThrow('already registered');
    expect(() => new ServiceConfigurationRegistry([{
      key: 'backup', displayName: 'Backup', providers: [
        { key: 'same', displayName: 'One', fields: [] },
        { key: 'same', displayName: 'Two', fields: [] },
      ],
    }])).toThrow('duplicated');
  });

  it('rejects duplicate fields and secret fields exposed to the client', () => {
    expect(() => new ServiceConfigurationRegistry([{
      key: 'mail', displayName: 'Mail', providers: [{
        key: 'smtp', displayName: 'SMTP', fields: [
          { key: 'host', type: 'string', source: 'deployment', required: false, secret: false, clientVisible: false, restartRequired: true, description: '' },
          { key: 'host', type: 'string', source: 'deployment', required: false, secret: false, clientVisible: false, restartRequired: true, description: '' },
        ],
      }],
    }])).toThrow('duplicated');

    expect(() => new ServiceConfigurationRegistry([{
      key: 'mail', displayName: 'Mail', providers: [{
        key: 'smtp', displayName: 'SMTP', fields: [{
          key: 'password', type: 'secret-reference', source: 'secret', required: true,
          secret: true, clientVisible: true, restartRequired: true, description: '',
        }],
      }],
    }])).toThrow('non-visible');
  });
});
