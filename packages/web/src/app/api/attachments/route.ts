import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { defaultAttachmentSecurityPolicy, detectAttachmentType } from '@dashboard/core/browser';
import { auth } from '../../../auth';
import { authenticatedUser, assertAttachmentAccess, assertAttachmentField, parseAttachmentTarget } from './attachmentAccess';

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
    const access = await assertAttachmentAccess(actorUserId, target.resourceType, target.resourceId, 'read');
    if (!access) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    if (!(await assertAttachmentField(target.resourceType, access.resourceTypeId, target.fieldKey, target.kind))) return NextResponse.json({ error: 'INVALID_ATTACHMENT_FIELD' }, { status: 400 });
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
  if (file.size > defaultAttachmentSecurityPolicy.maxFileSizeBytes) return NextResponse.json({ error: 'ATTACHMENT_TOO_LARGE' }, { status: 413 });

  try {
    const access = await assertAttachmentAccess(actorUserId, target.resourceType, target.resourceId);
    if (!access) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    if (!(await assertAttachmentField(target.resourceType, access.resourceTypeId, target.fieldKey, target.kind))) return NextResponse.json({ error: 'INVALID_ATTACHMENT_FIELD' }, { status: 400 });
    const { attachmentStorage, attachmentRateLimiter, attachmentScanner, auditPort, pgExecutor, resourceSecurityPolicyResolver } = await import('../../../server/db');
    if (!attachmentRateLimiter.consume(actorUserId, defaultAttachmentSecurityPolicy.maxUploadsPerHour)) {
      return NextResponse.json({ error: 'ATTACHMENT_RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '3600' } });
    }
    const content = new Uint8Array(await file.arrayBuffer());
    const detected = detectAttachmentType(file.name, file.type || 'application/octet-stream', content, target.kind);
    if (!detected) return NextResponse.json({ error: 'ATTACHMENT_CONTENT_TYPE_MISMATCH' }, { status: 415 });
    const securityPolicy = await resourceSecurityPolicyResolver.resolve(target.resourceType, target.resourceId);
    if (securityPolicy.antivirusEnabled && !attachmentScanner) {
      return NextResponse.json({ error: 'ATTACHMENT_SCANNER_UNAVAILABLE' }, { status: 503 });
    }
    if (securityPolicy.antivirusEnabled && attachmentScanner && await attachmentScanner.scan(content, { fileName: file.name, mimeType: detected.mimeType }) === 'infected') {
      return NextResponse.json({ error: 'ATTACHMENT_INFECTED' }, { status: 422 });
    }
    const quota = await pgExecutor.query<{ total: string }>(
      'SELECT COALESCE(SUM(size_bytes), 0)::text AS total FROM resource_attachments WHERE resource_type = $1 AND resource_id = $2',
      [target.resourceType, target.resourceId],
    );
    if (Number(quota.rows[0]?.total ?? 0) + content.byteLength > defaultAttachmentSecurityPolicy.maxResourceBytes) {
      return NextResponse.json({ error: 'ATTACHMENT_QUOTA_EXCEEDED' }, { status: 413 });
    }
    const attachmentId = randomUUID();
    const safeName = file.name.replace(/[\r\n"\\/]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-255) || 'upload';
    const storageKey = `${target.resourceType}/${target.resourceId}/${attachmentId}-${safeName}`;
    const stored = await attachmentStorage.put(storageKey, content, { encrypt: securityPolicy.encryptionEnabled });
    try {
      await pgExecutor.query(
      `INSERT INTO resource_attachments
       (id, resource_type, resource_id, field_key, kind, file_name, mime_type, size_bytes, storage_key, checksum, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [attachmentId, target.resourceType, target.resourceId, target.fieldKey, target.kind, safeName, detected.mimeType, stored.sizeBytes, stored.storageKey, stored.checksum, actorUserId],
      );
    } catch (error) {
      await attachmentStorage.delete(storageKey).catch((cleanupError) => console.error('[Attachments] Orphan cleanup failed', cleanupError));
      throw error;
    }
    await auditPort.record(actorUserId, 'attachment.upload', 'attachment', attachmentId, access.scopeNodeId, null, {
      resourceType: target.resourceType, resourceId: target.resourceId, fileName: safeName,
      mimeType: detected.mimeType, sizeBytes: stored.sizeBytes, checksum: stored.checksum,
    });
    return NextResponse.json({ id: attachmentId, fileName: safeName, mimeType: detected.mimeType, sizeBytes: stored.sizeBytes });
  } catch (error) {
    console.error('[Attachments] Upload failed', error);
    return NextResponse.json({ error: 'ATTACHMENT_UPLOAD_FAILED' }, { status: 500 });
  }
});
