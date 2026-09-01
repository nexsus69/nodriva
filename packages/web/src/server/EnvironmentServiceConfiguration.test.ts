import { describe, expect, it } from 'vitest';
import {
  EnvironmentSecretReferenceResolver,
  EnvironmentServiceDeploymentConfigurationSource,
  getPostgresConnectionConfiguration,
  getSecurityKeyConfiguration,
} from './EnvironmentServiceConfiguration';

describe('Environment service configuration', () => {
  it('maps the existing database and realtime deployment variables', async () => {
    const source = new EnvironmentServiceDeploymentConfigurationSource({
      DATABASE_URL: 'postgresql://dashboard_web:password@db.example:5433/dashboard?sslmode=require',
      REALTIME_INTERNAL_HOST: 'soketi',
      REALTIME_INTERNAL_PORT: '6001',
      REALTIME_INTERNAL_SCHEME: 'http',
      PUSHER_APP_ID: 'dashboard',
      NEXT_PUBLIC_PUSHER_CLUSTER: 'mt1',
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
    expect(getPostgresConnectionConfiguration({
      DATABASE_URL: 'postgresql://dashboard_web:password@db.example:5433/dashboard?sslmode=require',
    })).toEqual({
      host: 'db.example', port: 5433, database: 'dashboard', user: 'dashboard_web', password: 'password', ssl: true,
    });
  });

  it('resolves only allowed environment secret references', async () => {
    const resolver = new EnvironmentSecretReferenceResolver({ PUSHER_SECRET: 'secret-value', DATABASE_URL: 'postgresql://user:database-password@db/dashboard' });

    await expect(resolver.resolve('secret://env/PUSHER_SECRET')).resolves.toBe('secret-value');
    await expect(resolver.resolve('secret://file/PUSHER_SECRET')).resolves.toBeNull();
    await expect(resolver.resolve('secret://env/MISSING')).resolves.toBeNull();
    await expect(resolver.resolve('secret://env/DATABASE_URL_PASSWORD')).resolves.toBe('database-password');
  });

  it('selects the SQLite deployment profile without requiring DATABASE_URL', async () => {
    const source = new EnvironmentServiceDeploymentConfigurationSource({
      DATABASE_ADAPTER: 'sqlite',
      SQLITE_DATABASE_PATH: './data/test.sqlite',
    });

    await expect(source.get('database')).resolves.toEqual({
      providerKey: 'sqlite',
      values: { path: './data/test.sqlite' },
    });
    expect(source.isProduction()).toBe(false);
    expect(source.requiresRestrictedDatabaseRole()).toBe(false);
    await expect(source.get('attachment-storage')).resolves.toEqual({
      providerKey: 'filesystem', values: { path: './.data/attachments' },
    });
  });

  it('resolves security keys only for server-side adapter construction', () => {
    const configuration = getSecurityKeyConfiguration({
      FIELD_ENCRYPTION_KEY: '11'.repeat(32),
      FIELD_ENCRYPTION_ACTIVE_VERSION: 'v2',
      ATTACHMENTS_ENCRYPTION_KEYS: 'v1=' + '22'.repeat(32),
      MFA_ENCRYPTION_KEY: '33'.repeat(32),
    });

    expect(configuration).toEqual({
      fieldEncryptionKey: '11'.repeat(32),
      fieldEncryptionKeys: undefined,
      fieldEncryptionActiveVersion: 'v2',
      attachmentEncryptionKey: undefined,
      attachmentEncryptionKeys: 'v1=' + '22'.repeat(32),
      attachmentEncryptionActiveVersion: undefined,
      mfaEncryptionKey: '33'.repeat(32),
    });
  });

  it('maps a provider-agnostic S3-compatible deployment without exposing credentials', async () => {
    const source = new EnvironmentServiceDeploymentConfigurationSource({ ATTACHMENTS_STORAGE_PROVIDER: 's3-compatible', S3_ENDPOINT: 'https://minio.example', S3_BUCKET: 'nodriva', S3_REGION: 'us-east-1', S3_ACCESS_KEY: 'access', S3_SECRET_KEY: 'secret' });
    await expect(source.get('attachment-storage')).resolves.toMatchObject({ providerKey: 's3-compatible', values: { endpoint: 'https://minio.example', bucket: 'nodriva', accessKey: 'secret://env/S3_ACCESS_KEY', secretKey: 'secret://env/S3_SECRET_KEY' } });
  });
});
