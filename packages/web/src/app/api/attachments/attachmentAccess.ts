/** Parses attachment HTTP targets; application services own access policy. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AttachmentTarget {
  resourceType: 'node' | 'entity';
  resourceId: string;
  fieldKey: string;
  kind: 'file' | 'image';
}

export function parseAttachmentTarget(value: Partial<Record<string, FormDataEntryValue>>): AttachmentTarget | null {
  const { resourceType, resourceId, fieldKey, kind } = value;
  if (!resourceType || !resourceId || !fieldKey || !kind) return null;
  if (resourceType !== 'node' && resourceType !== 'entity') return null;
  if (kind !== 'file' && kind !== 'image') return null;
  // PostgreSQL UUID values are syntactically valid even when they use a
  // non-RFC version nibble (for example seeded all-zero node identifiers).
  if (!UUID_PATTERN.test(resourceId as string)) return null;
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(fieldKey as string)) return null;
  return { resourceType, resourceId: resourceId as string, fieldKey: fieldKey as string, kind };
}
