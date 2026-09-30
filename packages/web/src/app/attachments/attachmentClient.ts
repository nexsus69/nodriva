/** Sends versioned attachment commands and reconciles authoritative resource responses. */
import { AppCache } from '../cache/GlobalCacheClient';
import type { ClientNode, ClientEntity } from '../types/models';
import { defaultAttachmentSecurityPolicy, detectAttachmentType } from '@dashboard/core/browser';

export interface AttachmentItem {
  id: string;
  resourceType: 'node' | 'entity';
  resourceId: string;
  fieldKey: string;
  kind: 'file' | 'image';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Valida il contenuto nel browser prima di creare o modificare la risorsa. */
export async function validateResourceAttachmentFile(
  file: File,
  kind: 'file' | 'image',
): Promise<string | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!detectAttachmentType(file.name, file.type, bytes, kind, defaultAttachmentSecurityPolicy)) {
    return `Il file "${file.name}" non è un allegato ${kind} valido.`;
  }
  return null;
}

async function readResponse(response: Response): Promise<unknown> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) AppCache.purgeAll();
    const code = typeof body === 'object' && body && 'error' in body ? String(body.error) : 'INTERNAL_ERROR';
    throw Object.assign(new Error(code), { code });
  }
  return body;
}

export async function uploadResourceAttachment(input: {
  resourceType: 'node' | 'entity';
  resourceId: string;
  fieldKey: string;
  kind: 'file' | 'image';
  file: File;
  expectedRowVersion: number;
}): Promise<AttachmentItem & { rowVersion: number }> {
  const form = new FormData();
  form.set('resourceType', input.resourceType);
  form.set('resourceId', input.resourceId);
  form.set('fieldKey', input.fieldKey);
  form.set('kind', input.kind);
  form.set('file', input.file);
  form.set('expectedRowVersion', String(input.expectedRowVersion));
  const attachment = await AppCache.mutations.run(`${input.resourceType}:${input.resourceId}`, async (mutationId) =>
    await readResponse(await fetch('/api/attachments', { method: 'POST', headers: { 'X-Mutation-Id': mutationId }, body: form })) as AttachmentItem & { rowVersion: number; resource: ClientNode | ClientEntity },
  (result) => acceptAttachmentResource(result.resource));
  AppCache.notifyAttachmentCollectionChanged(input);
  return attachment;
}

export async function listResourceAttachments(resourceType: 'node' | 'entity', resourceId: string, fieldKey: string, kind: 'file' | 'image'): Promise<AttachmentItem[]> {
  const query = new URLSearchParams({ resourceType, resourceId, fieldKey, kind });
  return await readResponse(await fetch(`/api/attachments?${query.toString()}`, { cache: 'no-store' })) as AttachmentItem[];
}

export async function deleteResourceAttachment(input: { id: string; resourceType: 'node' | 'entity'; resourceId: string; expectedRowVersion: number }): Promise<number> {
  const result = await AppCache.mutations.run(`${input.resourceType}:${input.resourceId}`, async (mutationId) =>
    await readResponse(await fetch(`/api/attachments/${input.id}`, { method: 'DELETE', headers: { 'If-Match': String(input.expectedRowVersion), 'X-Mutation-Id': mutationId } })) as { rowVersion: number; resource: ClientNode | ClientEntity },
  (value) => acceptAttachmentResource(value.resource));
  AppCache.notifyAttachmentCollectionChanged(input);
  return result.rowVersion;
}

function acceptAttachmentResource(resource: ClientNode | ClientEntity): void {
  const cache = 'entityTypeId' in resource ? AppCache.getEntityCache(resource.entityTypeId) : AppCache.nodes;
  const current = cache.get(resource.id);
  if (!current || current.rowVersion <= resource.rowVersion) cache.inject(resource.id, resource);
}
