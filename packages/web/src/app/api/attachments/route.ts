import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { authenticatedUser, assertAttachmentAccess, parseAttachmentTarget } from './attachmentAccess';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const POST = auth(async (request) => {
  const actorUserId = authenticatedUser(request);
  if (!actorUserId) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  const target = parseAttachmentTarget({
    resourceType: form.get('resourceType') ?? undefined,
    resourceId: form.get('resourceId') ?? undefined,
    fieldKey: form.get('fieldKey') ?? undefined,
    kind: form.get('kind') ?? undefined,
  });
  if (!target || !(file instanceof File)) return NextResponse.json({ error: 'INVALID_ATTACHMENT_REQUEST' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'ATTACHMENT_TOO_LARGE' }, { status: 413 });
  if (target.kind === 'image' && !file.type.startsWith('image/')) return NextResponse.json({ error: 'INVALID_IMAGE_TYPE' }, { status: 415 });

  try {
    const access = await assertAttachmentAccess(actorUserId, target.resourceType, target.resourceId);
    if (!access) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    const { attachmentStorage, pgExecutor } = await import('../../../server/db');
    const attachmentId = randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-255) || 'upload';
    const storageKey = `${target.resourceType}/${target.resourceId}/${attachmentId}-${safeName}`;
    const stored = await attachmentStorage.put(storageKey, new Uint8Array(await file.arrayBuffer()));
    await pgExecutor.query(
      `INSERT INTO resource_attachments
       (id, resource_type, resource_id, field_key, kind, file_name, mime_type, size_bytes, storage_key, checksum, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [attachmentId, target.resourceType, target.resourceId, target.fieldKey, target.kind, safeName, file.type || 'application/octet-stream', stored.sizeBytes, stored.storageKey, stored.checksum, actorUserId],
    );
    return NextResponse.json({ id: attachmentId, fileName: safeName, mimeType: file.type, sizeBytes: stored.sizeBytes });
  } catch (error) {
    console.error('[Attachments] Upload failed', error);
    return NextResponse.json({ error: 'ATTACHMENT_UPLOAD_FAILED' }, { status: 500 });
  }
});
