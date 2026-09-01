/** Maps the redacted service catalogue to human-oriented Administration operations. */
import type { PublicServiceConfiguration, ServiceHealthCheckResult } from '@dashboard/core';

export type ServiceOperationsScope = 'integrations' | 'recovery' | 'health';
export type ServicePresentationStatus = 'healthy' | 'unhealthy' | 'disabled' | 'unavailable' | 'configured' | 'not-checked';

const SERVICE_SCOPE: Record<ServiceOperationsScope, readonly PublicServiceConfiguration['serviceKey'][]> = {
  integrations: ['realtime', 'antivirus', 'mail', 'observability'],
  recovery: ['database', 'attachment-storage', 'backup', 'security-keys'],
  health: ['database', 'realtime', 'attachment-storage', 'antivirus', 'mail', 'backup', 'observability', 'security-keys'],
};

const SERVICE_LABEL_KEYS: Record<PublicServiceConfiguration['serviceKey'], string> = {
  database: 'admin.serviceDatabase',
  realtime: 'admin.serviceRealtime',
  'attachment-storage': 'admin.serviceAttachmentStorage',
  antivirus: 'admin.serviceAntivirus',
  mail: 'admin.serviceMail',
  backup: 'admin.serviceBackup',
  observability: 'admin.serviceObservability',
  'security-keys': 'admin.serviceSecurityKeys',
};

const PROVIDER_LABEL_KEYS: Record<string, string> = {
  postgres: 'admin.providerPostgres',
  sqlite: 'admin.providerSqlite',
  soketi: 'admin.providerSoketi',
  filesystem: 'admin.providerFilesystem',
  clamav: 'admin.providerClamav',
  webhook: 'admin.providerWebhook',
  'postgres-dump': 'admin.providerPostgresDump',
  'sqlite-snapshot': 'admin.providerSqliteSnapshot',
  prometheus: 'admin.providerPrometheus',
  environment: 'admin.providerEnvironment',
  disabled: 'admin.providerDisabled',
};

/** Narrows a service list to the services relevant to an administrator's current intent. */
export function servicesForScope(
  services: readonly PublicServiceConfiguration[],
  scope: ServiceOperationsScope,
): readonly PublicServiceConfiguration[] {
  const keys = SERVICE_SCOPE[scope];
  return services.filter((service) => keys.includes(service.serviceKey));
}

/** Resolves the visible state without making a missing or disabled integration look erroneous. */
export function servicePresentationStatus(
  service: PublicServiceConfiguration,
  health?: ServiceHealthCheckResult,
): ServicePresentationStatus {
  if (health) {
    if (health.status === 'not-configured') return 'unavailable';
    return health.status;
  }
  if (service.availability === 'not-configured') return 'unavailable';
  if (service.availability === 'disabled') return 'disabled';
  return 'configured';
}

/** Keeps registry keys technical while consistently presenting localized Admin labels. */
export function serviceLabelKey(serviceKey: PublicServiceConfiguration['serviceKey']): string {
  return SERVICE_LABEL_KEYS[serviceKey];
}

/** Uses a stable fallback for providers introduced by a newer server than the current client. */
export function providerLabel(providerKey: string, translate: (key: string) => string): string {
  const key = PROVIDER_LABEL_KEYS[providerKey];
  return key ? translate(key) : providerKey;
}

/** Assigns one visual vocabulary to service state across all operations views. */
export function serviceStatusTone(status: ServicePresentationStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'healthy' || status === 'configured') return 'success';
  if (status === 'unhealthy') return 'danger';
  if (status === 'disabled') return 'neutral';
  return 'warning';
}
