import type {
  SecretReferenceResolver,
  ServiceConfigurationKey,
  ServiceDeploymentConfigurationSource,
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
  constructor(private readonly environment: Environment = process.env) {}

  async get(serviceKey: ServiceConfigurationKey) {
    switch (serviceKey) {
      case 'database': return this.database();
      case 'realtime': return this.realtime();
      case 'attachment-storage': return this.attachmentStorage();
      case 'antivirus': return this.antivirus();
      case 'mail': return this.mail();
      case 'backup': return this.backup();
      case 'observability': return this.observability();
    }
  }

  private database() {
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
    return this.environment.ATTACHMENTS_ROOT
      ? { providerKey: 'filesystem', values: { path: this.environment.ATTACHMENTS_ROOT } }
      : null;
  }

  private antivirus() {
    return this.environment.CLAMAV_HOST
      ? {
        providerKey: 'clamav',
        values: {
          host: this.environment.CLAMAV_HOST,
          ...(optionalPort(this.environment.CLAMAV_PORT) ? { port: optionalPort(this.environment.CLAMAV_PORT) } : {}),
        },
      }
      : null;
  }

  private mail() {
    return this.environment.ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL
      ? { providerKey: 'webhook', values: { endpoint: this.environment.ACCOUNT_ACTION_DELIVERY_WEBHOOK_URL } }
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
}

/** Resolves only explicit secret references and never exposes the environment map. */
export class EnvironmentSecretReferenceResolver implements SecretReferenceResolver {
  constructor(private readonly environment: Environment = process.env) {}

  async resolve(reference: string): Promise<string | null> {
    const match = /^secret:\/\/env\/([A-Z0-9_]+)$/.exec(reference);
    if (!match) return null;
    if (match[1] === 'DATABASE_URL_PASSWORD') {
      const url = optionalUrl(this.environment.DATABASE_URL);
      return url?.password ? decodeURIComponent(url.password) : null;
    }
    return this.environment[match[1]!] ?? null;
  }
}
