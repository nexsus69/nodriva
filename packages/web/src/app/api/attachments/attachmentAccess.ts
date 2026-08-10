import type { TypeDomain } from '@dashboard/core';

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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resourceId as string)) return null;
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(fieldKey as string)) return null;
  return { resourceType, resourceId: resourceId as string, fieldKey: fieldKey as string, kind };
}

export async function assertAttachmentAccess(actorUserId: string, resourceType: TypeDomain, resourceId: string, access: 'read' | 'write' = 'write') {
  const { accessControlPort, nodeRepository, entityRepository } = await import('../../../server/db');
  if (resourceType === 'node') {
    const node = await nodeRepository.findById(resourceId);
    if (!node) return null;
    await accessControlPort.assertHasPermission(actorUserId, attachmentPermission('node', access), node.id);
    return { scopeNodeId: node.id };
  }
  const entity = await entityRepository.findById(resourceId);
  if (!entity) return null;
  await accessControlPort.assertHasPermission(actorUserId, attachmentPermission('entity', access), entity.parentNodeId);
  return { scopeNodeId: entity.parentNodeId };
}

export function authenticatedUser(request: { auth?: { userId?: string } | null }): string | null {
  return typeof request.auth?.userId === 'string' ? request.auth.userId : null;
}

export function attachmentPermission(resourceType: TypeDomain, access: 'read' | 'write'): string {
  return `${resourceType}.${access === 'write' ? 'edit' : 'read'}`;
}
