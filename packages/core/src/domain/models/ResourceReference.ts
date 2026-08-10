/**
 * Shared identity for domain resources that have distinct persistence models.
 * This is intentionally an application/domain abstraction, not a database table.
 */
export type ResourceKind = 'node' | 'entity';

export interface ResourceReference {
  resourceType: ResourceKind;
  resourceId: string;
}

export function resourceReference(resourceType: ResourceKind, resourceId: string): ResourceReference {
  return { resourceType, resourceId };
}
