import type { TypeDomain } from '@dashboard/core';

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

export async function assertAttachmentAccess(actorUserId: string, resourceType: TypeDomain, resourceId: string, access: 'read' | 'write' = 'write') {
  const { accessControlPort, nodeRepository, entityRepository } = await import('../../../server/db');
  if (resourceType === 'node') {
    const node = await nodeRepository.findById(resourceId);
    if (!node) return null;
    await accessControlPort.assertHasPermission(actorUserId, attachmentPermission('node', access), node.id);
    return { scopeNodeId: node.id, nodeTypeId: node.nodeTypeId, resourceTypeId: node.nodeTypeId };
  }
  const entity = await entityRepository.findById(resourceId);
  if (!entity) return null;
  await accessControlPort.assertHasPermission(actorUserId, attachmentPermission('entity', access), entity.parentNodeId);
  const parentNode = await nodeRepository.findById(entity.parentNodeId);
  if (!parentNode) return null;
  return { scopeNodeId: entity.parentNodeId, nodeTypeId: parentNode.nodeTypeId, resourceTypeId: entity.entityTypeId };
}

export async function assertAttachmentField(resourceType: TypeDomain, typeId: string, fieldKey: string, kind: 'file' | 'image'): Promise<boolean> {
  const { pgExecutor } = await import('../../../server/db');
  const table = resourceType === 'node' ? 'node_type_fields' : 'entity_type_fields';
  const typeColumn = resourceType === 'node' ? 'node_type_id' : 'entity_type_id';
  const result = await pgExecutor.query(
    `SELECT 1 FROM ${table} WHERE ${typeColumn} = $1 AND field_key = $2 AND data_type = $3`,
    [typeId, fieldKey, kind],
  );
  return result.rows.length > 0;
}

export function authenticatedUser(request: { auth?: { userId?: string } | null }): string | null {
  return typeof request.auth?.userId === 'string' ? request.auth.userId : null;
}

export function attachmentPermission(resourceType: TypeDomain, access: 'read' | 'write'): string {
  return `${resourceType}.${access === 'write' ? 'edit' : 'read'}`;
}
