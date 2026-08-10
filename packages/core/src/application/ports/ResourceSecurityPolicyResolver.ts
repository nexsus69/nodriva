export type SecuredResourceType = 'node' | 'entity';

export interface ResourceSecurityPolicy {
  encryptionEnabled: boolean;
  antivirusEnabled: boolean;
}

export interface ResourceSecurityPolicyResolver {
  resolve(resourceType: SecuredResourceType, resourceId: string): Promise<ResourceSecurityPolicy>;
}
