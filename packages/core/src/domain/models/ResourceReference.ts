/**
 * Shared identity for domain resources that have distinct persistence models.
 * This is intentionally an application/domain abstraction, not a database table.
 */
/** Resources that can be locked during an interactive edit session. */
export type ResourceKind =
  | 'node'
  | 'entity'
  | 'node_type'
  | 'entity_type'
  | 'user'
  | 'role'
  | 'scope_assignment'
  | 'system_setting'
  | 'runtime_capability'
  | 'placement_policy';

export interface ResourceReference {
  resourceType: ResourceKind;
  resourceId: string;
}

export function resourceReference(resourceType: ResourceKind, resourceId: string): ResourceReference {
  return { resourceType, resourceId };
}
