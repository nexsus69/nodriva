import type {
  SecretReferenceResolver,
  ServiceConfigurationKey,
  ServiceDeploymentConfigurationSource,
} from '@dashboard/core';
import {
  defaultServiceConfigurationRegistry,
  type ServiceConfigurationRegistry,
} from '@dashboard/core';

type Environment = Record<string, string | undefined>;

function optionalPort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function optionalUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Maps the current deployment environment to the service configuration contract. */
export class EnvironmentServiceDeploymentConfigurationSource implements ServiceDeploymentConfigurationSource {
  constructor(
    private readonly environment: Environment = process.env,
    private readonly registry: ServiceConfigurationRegistry = defaultServiceConfigurationRegistry,
  ) {}

  async get(serviceKey: ServiceConfigurationKey) {
    return this.getSync(serviceKey);
  }

  getSync(serviceKey: ServiceConfigurationKey) {
    let deployment: { providerKey: string; values: Readonly<Record<string, unknown>> } | null;
    switch (serviceKey) {
      case 'database': deployment = this.database(); break;
      case 'realtime': deployment = this.realtime(); break;
      case 'attachment-storage': deployment = this.attachmentStorage(); break;
      case 'antivirus': deployment = this.antivirus(); break;
      case 'mail': deployment = this.mail(); break;
      case 'backup': deployment = this.backup(); break;
      case 'observability': deployment = this.observability(); break;
      case 'security-keys': deployment = this.securityKeys(); break;
    }
    return deployment ? this.validateDeployment(serviceKey, deployment) : null;
  }

  private validateDeployment(serviceKey: ServiceConfigurationKey, deployment: { providerKey: string; values: Readonly<Record<string, unknown>> }) {
    const definition = this.registry.get(serviceKey);
    const provider = definition.providers.find((candidate) => candidate.key === deployment.providerKey);
    if (!provider) throw new Error(`Provider '${deployment.providerKey}' is not registered for service '${serviceKey}'.`);
    const fields = new Map(provider.fields.map((field) => [field.key, field]));
    for (const [key, value] of Object.entries(deployment.values)) {
      const field = fields.get(key);
      if (!field) throw new Error(`Configuration '${serviceKey}.${key}' is not registered for provider '${deployment.providerKey}'.`);
      const valid = field.type === 'boolean'
        ? typeof value === 'boolean'
        : field.type === 'integer'
          ? Number.isInteger(value)
          : typeof value === 'string';
      if (!valid) throw new Error(`Configuration '${serviceKey}.${key}' has an invalid value type.`);
      if (field.secret && (typeof value !== 'string' || !value.startsWith('secret://'))) {
        throw new Error(`Secret '${serviceKey}.${key}' must be a secret reference.`);
      }
    }
    return deployment;
  }

  resolveSecretSync(reference: string): string | null {
    return new EnvironmentSecretReferenceResolver(this.environment).resolveSync(reference);
  }

  isProduction(): boolean {
    return this.environment.NODE_ENV === 'production';
  }

  requiresRestrictedDatabaseRole(): boolean {
    return this.environment.REQUIRE_RESTRICTED_DB_ROLE === 'true';
  }

  private database() {
    if (this.environment.DATABASE_ADAPTER?.toLowerCase() === 'sqlite') {
      return {
        providerKey: 'sqlite',
        values: { path: this.environment.SQLITE_DATABASE_PATH || './data/dashboard.sqlite' },
      };
    }
    const url = optionalUrl(this.environment.DATABASE_URL);
    if (!url) return null;
    return {
      providerKey: 'postgres',
      values: {
        host: url.hostname,
        ...(optionalPort(url.port) ? { port: optionalPort(url.port) } : {}),
        name: decodeURIComponent(url.pathname.replace(/^\//, '')),
        user: decodeURIComponent(url.username),
        ...(url.searchParams.get('sslmode') ? { ssl: url.searchParams.get('sslmode') !== 'disable' } : {}),
        ...(url.password ? { password: 'secret://env/DATABASE_URL_PASSWORD' } : {}),
      },
    };
  }

  private realtime() {
    if (!this.environment.NEXT_PUBLIC_PUSHER_KEY && !this.environment.REALTIME_INTERNAL_HOST) return null;
    return {
      providerKey: 'soketi',
      values: {
        ...(this.environment.PUSHER_APP_ID ? { appId: this.environment.PUSHER_APP_ID } : {}),
        ...(this.environment.NEXT_PUBLIC_PUSHER_CLUSTER ? { cluster: this.environment.NEXT_PUBLIC_PUSHER_CLUSTER } : {}),
        ...(this.environment.REALTIME_INTERNAL_SCHEME ? { internalScheme: this.environment.REALTIME_INTERNAL_SCHEME } : {}),
        ...(this.environment.REALTIME_INTERNAL_HOST ? { internalHost: this.environment.REALTIME_INTERNAL_HOST } : {}),
        ...(optionalPort(this.environment.REALTIME_INTERNAL_PORT) ? { internalPort: optionalPort(this.environment.REALTIME_INTERNAL_PORT) } : {}),
        ...(this.environment.NEXT_PUBLIC_PUSHER_HOST ? { publicHost: this.environment.NEXT_PUBLIC_PUSHER_HOST } : {}),
        ...(optionalPort(this.environment.NEXT_PUBLIC_PUSHER_PORT) ? { publicPort: optionalPort(this.environment.NEXT_PUBLIC_PUSHER_PORT) } : {}),
        ...(this.environment.NEXT_PUBLIC_PUSHER_SCHEME ? { scheme: this.environment.NEXT_PUBLIC_PUSHER_SCHEME } : {}),
        ...(this.environment.NEXT_PUBLIC_PUSHER_KEY ? { appKey: this.environment.NEXT_PUBLIC_PUSHER_KEY } : {}),
        ...(this.environment.PUSHER_SECRET ? { appSecret: 'secret://env/PUSHER_SECRET' } : {}),
      },
    };
  }

  private attachmentStorage() {
    return {
      providerKey: 'filesystem',
      values: {
        // This is the documented standalone bootstrap default used by LocalAttachmentStorage.
        path: this.environment.ATTACHMENTS_ROOT || './.data/attachments',
        ...(this.environment.ATTACHMENTS_REQUIRE_ENCRYPTION ? { encryptionRequired: this.environment.ATTACHMENTS_REQUIRE_ENCRYPTION === 'true' } : {}),
      },
    };
  }

  private antivirus() {
    return this.environment.CLAMAV_HOST
      ? {
        providerKey: 'clamav',
        values: {
          host: this.environment.CLAMAV_HOST,
          ...(optionalPort(this.environment.CLAMAV_PORT) ? { port: optionalPort(this.environment.CLAMAV_PORT) } : {}),
          ...(optionalPort(this.environment.CLAMAV_TIMEOUT_MS) ? { timeoutMs: optionalPort(this.environment.CLAMAV_TIMEOUT_MS) } : {}),
          ...(this.environment.ATTACHMENTS_REQUIRE_SCAN ? { requireScan: this.environment.ATTACHMENTS_REQUIRE_SCAN === 'true' } : {}),
        },
      }
      : null;
  }

  private mail() {
    return this.environment.ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL
      ? {
        providerKey: 'webhook',
        values: {
          endpoint: this.environment.ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL,
          ...(this.environment.ACCOUNT_ACTION_PUBLIC_BASE_URL ? { publicBaseUrl: this.environment.ACCOUNT_ACTION_PUBLIC_BASE_URL } : {}),
          ...(optionalPort(this.environment.ACCOUNT_ACTION_DELIVERY_TIMEOUT_MS) ? { timeoutMs: optionalPort(this.environment.ACCOUNT_ACTION_DELIVERY_TIMEOUT_MS) } : {}),
          ...(this.environment.ACCOUNT_ACTION_DELIVERY_WEBHOOK_SECRET ? { token: 'secret://env/ACCOUNT_ACTION_DELIVERY_WEBHOOK_SECRET' } : {}),
        },
      }
      : null;
  }

  private backup() {
    return this.environment.BACKUP_ROOT
      ? { providerKey: 'postgres-dump', values: { path: this.environment.BACKUP_ROOT } }
      : null;
  }

  private observability() {
    return this.environment.PROMETHEUS_ENDPOINT
      ? { providerKey: 'prometheus', values: { endpoint: this.environment.PROMETHEUS_ENDPOINT } }
      : null;
  }

  private securityKeys() {
    const values = {
      ...(this.environment.FIELD_ENCRYPTION_KEY ? { fieldEncryptionKey: 'secret://env/FIELD_ENCRYPTION_KEY' } : {}),
      ...(this.environment.FIELD_ENCRYPTION_KEYS ? { fieldEncryptionKeys: 'secret://env/FIELD_ENCRYPTION_KEYS' } : {}),
      ...(this.environment.FIELD_ENCRYPTION_ACTIVE_VERSION ? { fieldEncryptionActiveVersion: this.environment.FIELD_ENCRYPTION_ACTIVE_VERSION } : {}),
      ...(this.environment.ATTACHMENTS_ENCRYPTION_KEY ? { attachmentEncryptionKey: 'secret://env/ATTACHMENTS_ENCRYPTION_KEY' } : {}),
      ...(this.environment.ATTACHMENTS_ENCRYPTION_KEYS ? { attachmentEncryptionKeys: 'secret://env/ATTACHMENTS_ENCRYPTION_KEYS' } : {}),
      ...(this.environment.ATTACHMENTS_ENCRYPTION_ACTIVE_VERSION ? { attachmentEncryptionActiveVersion: this.environment.ATTACHMENTS_ENCRYPTION_ACTIVE_VERSION } : {}),
      ...(this.environment.MFA_ENCRYPTION_KEY ? { mfaEncryptionKey: 'secret://env/MFA_ENCRYPTION_KEY' } : {}),
    };
    return Object.keys(values).length > 0 ? { providerKey: 'environment', values } : null;
  }
}

export interface PostgresConnectionConfiguration {
  host: string;
  port?: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}

/** Builds the driver configuration from the registered database deployment contract. */
export function getPostgresConnectionConfiguration(environment: Environment | EnvironmentServiceDeploymentConfigurationSource = process.env): PostgresConnectionConfiguration {
  const source = environment instanceof EnvironmentServiceDeploymentConfigurationSource
    ? environment.getSync('database')
    : new EnvironmentServiceDeploymentConfigurationSource(environment as Environment).getSync('database');
  if (!source || source.providerKey !== 'postgres') {
    throw new Error('DATABASE_URL environment variable is missing or does not describe a PostgreSQL deployment.');
  }
  const values: Readonly<Record<string, unknown>> = source.values;
  const resolver = environment instanceof EnvironmentServiceDeploymentConfigurationSource
    ? { resolveSync: (reference: string) => environment.resolveSecretSync(reference) }
    : new EnvironmentSecretReferenceResolver(environment as Environment);
  const passwordReference = values.password;
  return {
    host: String(values.host),
    ...(typeof values.port === 'number' ? { port: values.port } : {}),
    database: String(values.name),
    user: String(values.user),
    ...(typeof passwordReference === 'string' ? { password: resolver.resolveSync(passwordReference) ?? undefined } : {}),
    ...(typeof values.ssl === 'boolean' ? { ssl: values.ssl } : {}),
  };
}

export interface SecurityKeyConfiguration {
  fieldEncryptionKey?: string;
  fieldEncryptionKeys?: string;
  fieldEncryptionActiveVersion?: string;
  attachmentEncryptionKey?: string;
  attachmentEncryptionKeys?: string;
  attachmentEncryptionActiveVersion?: string;
  mfaEncryptionKey?: string;
}

/** Resolves deployment-only encryption secrets for server-side adapter construction. */
export function getSecurityKeyConfiguration(environment: Environment | EnvironmentServiceDeploymentConfigurationSource = process.env): SecurityKeyConfiguration {
  const source = environment instanceof EnvironmentServiceDeploymentConfigurationSource
    ? environment.getSync('security-keys')
    : new EnvironmentServiceDeploymentConfigurationSource(environment as Environment).getSync('security-keys');
  const values: Readonly<Record<string, unknown>> = source?.providerKey === 'environment' ? source.values : {};
  const resolver = environment instanceof EnvironmentServiceDeploymentConfigurationSource
    ? { resolveSync: (reference: string) => environment.resolveSecretSync(reference) }
    : new EnvironmentSecretReferenceResolver(environment as Environment);
  const resolve = (key: string) => {
    const reference = values[key];
    return typeof reference === 'string' ? resolver.resolveSync(reference) ?? undefined : undefined;
  };
  return {
    fieldEncryptionKey: resolve('fieldEncryptionKey'),
    fieldEncryptionKeys: resolve('fieldEncryptionKeys'),
    fieldEncryptionActiveVersion: typeof values.fieldEncryptionActiveVersion === 'string' ? values.fieldEncryptionActiveVersion : undefined,
    attachmentEncryptionKey: resolve('attachmentEncryptionKey'),
    attachmentEncryptionKeys: resolve('attachmentEncryptionKeys'),
    attachmentEncryptionActiveVersion: typeof values.attachmentEncryptionActiveVersion === 'string' ? values.attachmentEncryptionActiveVersion : undefined,
    mfaEncryptionKey: resolve('mfaEncryptionKey'),
  };
}

/** Resolves only explicit secret references and never exposes the environment map. */
export class EnvironmentSecretReferenceResolver implements SecretReferenceResolver {
  constructor(private readonly environment: Environment = process.env) {}

  async resolve(reference: string): Promise<string | null> {
    return this.resolveSync(reference);
  }

  resolveSync(reference: string): string | null {
    const match = /^secret:\/\/env\/([A-Z0-9_]+)$/.exec(reference);
    if (!match) return null;
    if (match[1] === 'DATABASE_URL_PASSWORD') {
      const url = optionalUrl(this.environment.DATABASE_URL);
      return url?.password ? decodeURIComponent(url.password) : null;
    }
    return this.environment[match[1]!] ?? null;
  }
}

export function getRealtimePusherConfiguration(environment: Environment | EnvironmentServiceDeploymentConfigurationSource = process.env, perspective: 'public' | 'internal' = 'public') {
  const source = environment instanceof EnvironmentServiceDeploymentConfigurationSource
    ? environment.getSync('realtime')
    : new EnvironmentServiceDeploymentConfigurationSource(environment as Environment).getSync('realtime');
  const values: Readonly<Record<string, unknown>> = source?.providerKey === 'soketi' ? source.values : {};
  const secrets = environment instanceof EnvironmentServiceDeploymentConfigurationSource
    ? { resolveSync: (reference: string) => environment.resolveSecretSync(reference) }
    : new EnvironmentSecretReferenceResolver(environment as Environment);
  const host = perspective === 'internal' ? values.internalHost : values.publicHost;
  const port = perspective === 'internal' ? values.internalPort : values.publicPort;
  return {
    appId: String(values.appId ?? ''),
    key: String(values.appKey ?? ''),
    secret: secrets.resolveSync(String(values.appSecret ?? '')) ?? '',
    cluster: String(values.cluster ?? ''),
    useTLS: perspective === 'internal' ? values.internalScheme === 'https' : values.scheme === 'https',
    host: typeof host === 'string' && host.length > 0 ? host : undefined,
    port: typeof port === 'number' ? String(port) : undefined,
    enabled: true,
  };
}
