import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { authenticatedUser, assertAttachmentAccess, assertAttachmentField } from '../attachmentAccess';
import { publishAuditRealtimeChange } from '../../../../server/adminRealtime';
import { publishRealtimeChange } from '../../../../server/realtime';

type AttachmentRow = { id: string; resourceType: 'node' | 'entity'; resourceId: string; fieldKey: string; kind: 'file' | 'image'; fileName: string; mimeType: string; storageKey: string };
const safeInlineTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

async function findAttachment(id: string): Promise<AttachmentRow | null> {
  const { attachmentRepository } = await import('../../../../server/db');
  const attachment = await attachmentRepository.getById(id);
  return attachment ? { id: attachment.id, resourceType: attachment.resourceType, resourceId: attachment.resourceId, fieldKey: attachment.fieldKey, kind: attachment.kind, fileName: attachment.fileName, mimeType: attachment.mimeType, storageKey: attachment.storageKey } : null;
}

export const GET = auth(async (request, context: { params: Promise<{ attachmentId: string }> }) => {
  const actorUserId = authenticatedUser(request);
  if (!actorUserId) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
  const { attachmentId } = await context.params;
  const attachment = await findAttachment(attachmentId);
  if (!attachment) return NextResponse.json({ error: 'ATTACHMENT_NOT_FOUND' }, { status: 404 });
  try {
    const access = await assertAttachmentAccess(actorUserId, attachment.resourceType, attachment.resourceId, 'read');
    if (!access) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    if (!(await assertAttachmentField(attachment.resourceType, access.resourceTypeId, attachment.fieldKey, attachment.kind))) return NextResponse.json({ error: 'INVALID_ATTACHMENT_FIELD' }, { status: 400 });
    const { attachmentStorage, auditPort } = await import('../../../../server/db');
    const content = await attachmentStorage.get(attachment.storageKey);
    if (!content) return NextResponse.json({ error: 'ATTACHMENT_CONTENT_NOT_FOUND' }, { status: 404 });
    const inline = safeInlineTypes.has(attachment.mimeType);
    const contentType = inline ? attachment.mimeType : 'application/octet-stream';
    const disposition = inline ? 'inline' : 'attachment';
    await auditPort.record(actorUserId, 'attachment.download', 'attachment', attachment.id, access.scopeNodeId, null, { resourceType: attachment.resourceType, resourceId: attachment.resourceId, fileName: attachment.fileName });
    return new Response(Buffer.from(content), { headers: {
      'Content-Type': contentType,
      'Content-Length': String(content.byteLength),
      'Content-Disposition': `${disposition}; filename="${attachment.fileName.replace(/[\r\n"\\]/g, '_')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': inline ? "default-src 'none'; img-src 'self'" : "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'private, no-store',
    } });
  } catch (error) {
    console.error('[Attachments] Download failed', error);
    return NextResponse.json({ error: 'ATTACHMENT_DOWNLOAD_FAILED' }, { status: 500 });
  }
});

export const DELETE = auth(async (request, context: { params: Promise<{ attachmentId: string }> }) => {
  const actorUserId = authenticatedUser(request);
  if (!actorUserId) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
  const { attachmentId } = await context.params;
  const attachment = await findAttachment(attachmentId);
  if (!attachment) return NextResponse.json({ error: 'ATTACHMENT_NOT_FOUND' }, { status: 404 });
  try {
    const access = await assertAttachmentAccess(actorUserId, attachment.resourceType, attachment.resourceId);
    if (!access) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    if (!(await assertAttachmentField(attachment.resourceType, access.resourceTypeId, attachment.fieldKey, attachment.kind))) return NextResponse.json({ error: 'INVALID_ATTACHMENT_FIELD' }, { status: 400 });
    const { attachmentStorage, auditPort, attachmentRepository } = await import('../../../../server/db');
    await attachmentStorage.delete(attachment.storageKey);
    await attachmentRepository.delete(attachmentId);
    await auditPort.record(actorUserId, 'attachment.delete', 'attachment', attachment.id, access.scopeNodeId, { resourceType: attachment.resourceType, resourceId: attachment.resourceId, fileName: attachment.fileName }, null);
    void publishRealtimeChange({
      resourceType: attachment.resourceType,
      resourceId: attachment.resourceId,
      changeType: 'updated',
      actorUserId,
      parentNodeId: attachment.resourceType === 'entity' ? access.scopeNodeId : null,
      subresourceKind: 'attachment',
    }).catch((error) => console.error('[Attachments] Realtime delete event failed', error));
    void publishAuditRealtimeChange({ resourceType: attachment.resourceType, resourceId: attachment.id, changeType: 'deleted', actorUserId })
      .catch((error) => console.error('[Attachments] Realtime audit event failed', error));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[Attachments] Delete failed', error);
    return NextResponse.json({ error: 'ATTACHMENT_DELETE_FAILED' }, { status: 500 });
  }
});
