export type LockResourceType = 'node' | 'entity';

// PostgreSQL accepts UUID values independently of their RFC version/variant
// bits. Seed data intentionally uses deterministic UUID-shaped identifiers
// with zeroed version and variant groups.
const POSTGRES_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateLockResource(
  resourceType: string,
  resourceId: string
): LockResourceType {
  if (resourceType !== 'node' && resourceType !== 'entity') {
    throw new Error('Unsupported lock resource type.');
  }
  if (!POSTGRES_UUID_PATTERN.test(resourceId)) {
    throw new Error('Invalid lock resource identifier.');
  }
  return resourceType;
}
