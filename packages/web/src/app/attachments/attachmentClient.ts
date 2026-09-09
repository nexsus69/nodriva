import { AppCache } from '../cache/GlobalCacheClient';

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
  if (!response.ok) throw new Error(typeof body === 'object' && body && 'error' in body ? String(body.error) : 'Operazione allegato fallita.');
  return body;
}

export async function uploadResourceAttachment(input: {
  resourceType: 'node' | 'entity';
  resourceId: string;
  fieldKey: string;
  kind: 'file' | 'image';
  file: File;
}): Promise<AttachmentItem> {
  const form = new FormData();
  form.set('resourceType', input.resourceType);
  form.set('resourceId', input.resourceId);
  form.set('fieldKey', input.fieldKey);
  form.set('kind', input.kind);
  form.set('file', input.file);
  const attachment = await readResponse(await fetch('/api/attachments', { method: 'POST', body: form })) as AttachmentItem;
  AppCache.notifyAttachmentCollectionChanged(input);
  return attachment;
}

export async function listResourceAttachments(resourceType: 'node' | 'entity', resourceId: string, fieldKey: string, kind: 'file' | 'image'): Promise<AttachmentItem[]> {
  const query = new URLSearchParams({ resourceType, resourceId, fieldKey, kind });
  return await readResponse(await fetch(`/api/attachments?${query.toString()}`, { cache: 'no-store' })) as AttachmentItem[];
}

export async function deleteResourceAttachment(input: { id: string; resourceType: 'node' | 'entity'; resourceId: string }): Promise<void> {
  await readResponse(await fetch(`/api/attachments/${input.id}`, { method: 'DELETE' }));
  AppCache.notifyAttachmentCollectionChanged(input);
}
import { defaultAttachmentSecurityPolicy, detectAttachmentType } from '@dashboard/core/browser';
