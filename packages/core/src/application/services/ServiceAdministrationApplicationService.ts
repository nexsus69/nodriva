/** Authorized read model for operational service configuration. */
import type { AccessControlPort } from '../ports/AccessControlPort.js';
import type { ServiceConfigurationKey } from '../config/ServiceConfigurationRegistry.js';
import type { ServiceHealthCheckResult } from '../ports/ServiceHealthCheckPort.js';
import type { PublicServiceConfiguration, ServiceConfigurationService } from './ServiceConfigurationService.js';
import type { ServiceHealthCheckService } from './ServiceHealthCheckService.js';

/**
 * Keeps Admin access to service topology intentionally read-only and sanitized.
 * Deployment values and secret references never cross this application boundary.
 */
export class ServiceAdministrationApplicationService {
  constructor(
    private readonly configuration: ServiceConfigurationService,
    private readonly health: ServiceHealthCheckService,
    private readonly accessControl: AccessControlPort,
  ) {}

  async list(actorUserId: string): Promise<readonly PublicServiceConfiguration[]> {
    await this.accessControl.assertHasPermission(actorUserId, 'system.config.read', null);
    return this.configuration.listPublic();
  }

  async checkHealth(actorUserId: string, serviceKey: ServiceConfigurationKey): Promise<ServiceHealthCheckResult> {
    await this.accessControl.assertHasPermission(actorUserId, 'system.config.read', null);
    return this.health.check(serviceKey);
  }
}
