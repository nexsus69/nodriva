import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { authenticatedUser, assertAttachmentAccess, parseAttachmentTarget } from './attachmentAccess';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const GET = auth(async (request) => {
  const actorUserId = authenticatedUser(request);
  if (!actorUserId) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
  const url = new URL(request.url);
  const target = parseAttachmentTarget({
    resourceType: url.searchParams.get('resourceType') ?? undefined,
    resourceId: url.searchParams.get('resourceId') ?? undefined,
    fieldKey: url.searchParams.get('fieldKey') ?? 'attachments',
    kind: url.searchParams.get('kind') ?? 'file',
  });
  if (!target) return NextResponse.json({ error: 'INVALID_ATTACHMENT_TARGET' }, { status: 400 });
  try {
    if (!(await assertAttachmentAccess(actorUserId, target.resourceType, target.resourceId, 'read'))) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    const { pgExecutor } = await import('../../../server/db');
    const result = await pgExecutor.query(
      `SELECT id, resource_type AS "resourceType", resource_id AS "resourceId", field_key AS "fieldKey", kind, file_name AS "fileName", mime_type AS "mimeType", size_bytes AS "sizeBytes"
       FROM resource_attachments WHERE resource_type = $1 AND resource_id = $2 AND ($3 = '' OR field_key = $3) ORDER BY created_at DESC`,
      [target.resourceType, target.resourceId, url.searchParams.get('fieldKey') ?? ''],
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[Attachments] List failed', error);
    return NextResponse.json({ error: 'ATTACHMENT_LIST_FAILED' }, { status: 500 });
  }
});

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
