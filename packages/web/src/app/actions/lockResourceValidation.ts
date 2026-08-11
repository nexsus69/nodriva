import type { ResourceKind } from '@dashboard/core';

export type LockResourceType = ResourceKind;

// PostgreSQL accepts UUID values independently of their RFC version/variant
// bits. Seed data intentionally uses deterministic UUID-shaped identifiers
// with zeroed version and variant groups.
const POSTGRES_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateLockResource(
  resourceType: string,
  resourceId: string
): LockResourceType {
  const uuidTypes = new Set<LockResourceType>([
    'node', 'entity', 'node_type', 'entity_type', 'user', 'role', 'scope_assignment',
  ]);
  const keyTypes = new Set<LockResourceType>([
    'system_setting', 'runtime_capability', 'placement_policy',
  ]);
  if (!uuidTypes.has(resourceType as LockResourceType) && !keyTypes.has(resourceType as LockResourceType)) {
    throw new Error('Unsupported lock resource type.');
  }
  if ((uuidTypes.has(resourceType as LockResourceType) && !POSTGRES_UUID_PATTERN.test(resourceId))
    || (keyTypes.has(resourceType as LockResourceType) && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(resourceId))) {
    throw new Error('Invalid lock resource identifier.');
  }
  return resourceType as LockResourceType;
}
