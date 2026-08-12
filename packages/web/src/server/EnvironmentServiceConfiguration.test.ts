import { describe, expect, it } from 'vitest';
import {
  EnvironmentSecretReferenceResolver,
  EnvironmentServiceDeploymentConfigurationSource,
} from './EnvironmentServiceConfiguration';

describe('Environment service configuration', () => {
  it('maps the existing database and realtime deployment variables', async () => {
    const source = new EnvironmentServiceDeploymentConfigurationSource({
      DATABASE_URL: 'postgresql://dashboard_web:password@db.example:5433/dashboard?sslmode=require',
      REALTIME_INTERNAL_HOST: 'soketi',
      REALTIME_INTERNAL_PORT: '6001',
      NEXT_PUBLIC_PUSHER_HOST: 'realtime.example',
      NEXT_PUBLIC_PUSHER_PORT: '443',
      NEXT_PUBLIC_PUSHER_SCHEME: 'https',
      NEXT_PUBLIC_PUSHER_KEY: 'public-key',
      PUSHER_SECRET: 'not-returned-as-a-value',
    });

    await expect(source.get('database')).resolves.toEqual({
      providerKey: 'postgres',
      values: {
        host: 'db.example', port: 5433, name: 'dashboard', user: 'dashboard_web', ssl: true,
        password: 'secret://env/DATABASE_URL_PASSWORD',
      },
    });
    await expect(source.get('realtime')).resolves.toMatchObject({
      providerKey: 'soketi',
      values: expect.objectContaining({ appKey: 'public-key', appSecret: 'secret://env/PUSHER_SECRET' }),
    });
  });

  it('resolves only allowed environment secret references', async () => {
    const resolver = new EnvironmentSecretReferenceResolver({ PUSHER_SECRET: 'secret-value', DATABASE_URL: 'postgresql://user:database-password@db/dashboard' });

    await expect(resolver.resolve('secret://env/PUSHER_SECRET')).resolves.toBe('secret-value');
    await expect(resolver.resolve('secret://file/PUSHER_SECRET')).resolves.toBeNull();
    await expect(resolver.resolve('secret://env/MISSING')).resolves.toBeNull();
    await expect(resolver.resolve('secret://env/DATABASE_URL_PASSWORD')).resolves.toBe('database-password');
  });
});
