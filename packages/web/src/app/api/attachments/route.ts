/** Serves and creates authorized attachments with transactional audit evidence. */
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { defaultAttachmentSecurityPolicy, detectAttachmentType } from '@dashboard/core/browser';
import { auth } from '../../../auth';
import { authenticatedUser, assertAttachmentAccess, assertAttachmentField, isAttachmentAccessDenied, parseAttachmentTarget } from './attachmentAccess';
import { publishRealtimeChange } from '../../../server/realtime';

class AttachmentQuotaExceededError extends Error {}

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
    const { attachmentRepository } = await import('../../../server/db');
    return NextResponse.json(await attachmentRepository.list(target.resourceType, target.resourceId, url.searchParams.get('fieldKey') ?? undefined));
  } catch (error) {
    if (isAttachmentAccessDenied(error)) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    console.error('[Attachments] List failed', error);
    return NextResponse.json({ error: 'ATTACHMENT_LIST_FAILED' }, { status: 500 });
  }
});

export const POST = auth(async (request) => {
  const actorUserId = authenticatedUser(request);
  if (!actorUserId) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > defaultAttachmentSecurityPolicy.maxFileSizeBytes + 1024 * 1024) {
    return NextResponse.json({ error: 'ATTACHMENT_TOO_LARGE' }, { status: 413 });
  }
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
    const { attachmentStorage, attachmentCleanupService, attachmentRateLimiter, attachmentScanner, auditPort, attachmentRepository, resourceSecurityPolicyResolver, transactionPort } = await import('../../../server/db');
    if (!(await attachmentRateLimiter.consume(actorUserId, defaultAttachmentSecurityPolicy.maxUploadsPerHour))) {
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
    const attachmentId = randomUUID();
    const safeName = file.name.replace(/[\r\n"\\/]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-255) || 'upload';
    const storageKey = `${target.resourceType}/${target.resourceId}/${attachmentId}-${safeName}`;
    // The staging record is durable before the non-transactional blob write.
    // A crash at any later point therefore leaves a recoverable cleanup job.
    await attachmentCleanupService.scheduleUploadStaging(storageKey);
    const stored = await attachmentStorage.put(storageKey, content, { encrypt: securityPolicy.encryptionEnabled });
    try {
      await transactionPort.runInTransaction(async () => {
        const transactionalAccess = await assertAttachmentAccess(actorUserId, target.resourceType, target.resourceId);
        if (!transactionalAccess) throw new Error('Attachment target disappeared during upload.');
        const created = await attachmentRepository.createWithinQuota(
          { id: attachmentId, resourceType: target.resourceType, resourceId: target.resourceId, fieldKey: target.fieldKey, kind: target.kind, fileName: safeName, mimeType: detected.mimeType, sizeBytes: stored.sizeBytes, storageKey: stored.storageKey, checksum: stored.checksum, createdBy: actorUserId },
          defaultAttachmentSecurityPolicy.maxResourceBytes,
        );
        if (!created) throw new AttachmentQuotaExceededError('Attachment resource quota exceeded');
        await auditPort.record(actorUserId, 'attachment.upload', 'attachment', attachmentId, transactionalAccess.scopeNodeId, null, {
          resourceType: target.resourceType, resourceId: target.resourceId, fileName: safeName,
          mimeType: detected.mimeType, sizeBytes: stored.sizeBytes, checksum: stored.checksum,
        });
        await attachmentCleanupService.cancel(stored.storageKey);
      });
    } catch (error) {
      try {
        await attachmentStorage.delete(storageKey);
        await attachmentCleanupService.cancel(storageKey);
      } catch (cleanupError) {
        console.error('[Attachments] Immediate orphan cleanup failed; durable retry retained', cleanupError);
      }
      if (error instanceof AttachmentQuotaExceededError) {
        return NextResponse.json({ error: 'ATTACHMENT_QUOTA_EXCEEDED' }, { status: 413 });
      }
      throw error;
    }
    void attachmentCleanupService.drain().catch((error) => {
      console.error('[Attachments] Post-commit cleanup drain failed', error);
    });
    void publishRealtimeChange({
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      changeType: 'updated',
      actorUserId,
      parentNodeId: target.resourceType === 'entity' ? access.scopeNodeId : null,
      subresourceKind: 'attachment',
    }).catch((error) => console.error('[Attachments] Realtime upload event failed', error));
    return NextResponse.json({ id: attachmentId, fileName: safeName, mimeType: detected.mimeType, sizeBytes: stored.sizeBytes });
  } catch (error) {
    if (isAttachmentAccessDenied(error)) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    console.error('[Attachments] Upload failed', error);
    return NextResponse.json({ error: 'ATTACHMENT_UPLOAD_FAILED' }, { status: 500 });
  }
});
