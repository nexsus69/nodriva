import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { authenticatedUser, assertAttachmentAccess } from '../attachmentAccess';

type AttachmentRow = { id: string; resource_type: 'node' | 'entity'; resource_id: string; file_name: string; mime_type: string; storage_key: string };
const safeInlineTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

async function findAttachment(id: string): Promise<AttachmentRow | null> {
  const { pgExecutor } = await import('../../../../server/db');
  const result = await pgExecutor.query<AttachmentRow>(
    'SELECT id, resource_type, resource_id, file_name, mime_type, storage_key FROM resource_attachments WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export const GET = auth(async (request, context: { params: Promise<{ attachmentId: string }> }) => {
  const actorUserId = authenticatedUser(request);
  if (!actorUserId) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
  const { attachmentId } = await context.params;
  const attachment = await findAttachment(attachmentId);
  if (!attachment) return NextResponse.json({ error: 'ATTACHMENT_NOT_FOUND' }, { status: 404 });
  try {
    const access = await assertAttachmentAccess(actorUserId, attachment.resource_type, attachment.resource_id, 'read');
    if (!access) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    const { attachmentStorage, auditPort } = await import('../../../../server/db');
    const content = await attachmentStorage.get(attachment.storage_key);
    if (!content) return NextResponse.json({ error: 'ATTACHMENT_CONTENT_NOT_FOUND' }, { status: 404 });
    const inline = safeInlineTypes.has(attachment.mime_type);
    const contentType = inline ? attachment.mime_type : 'application/octet-stream';
    const disposition = inline ? 'inline' : 'attachment';
    await auditPort.record(actorUserId, 'attachment.download', 'attachment', attachment.id, access.scopeNodeId, null, { resourceType: attachment.resource_type, resourceId: attachment.resource_id, fileName: attachment.file_name });
    return new Response(Buffer.from(content), { headers: {
      'Content-Type': contentType,
      'Content-Length': String(content.byteLength),
      'Content-Disposition': `${disposition}; filename="${attachment.file_name.replace(/[\r\n"\\]/g, '_')}"`,
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
    const access = await assertAttachmentAccess(actorUserId, attachment.resource_type, attachment.resource_id);
    if (!access) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    const { attachmentStorage, auditPort, pgExecutor } = await import('../../../../server/db');
    await attachmentStorage.delete(attachment.storage_key);
    await pgExecutor.query('DELETE FROM resource_attachments WHERE id = $1', [attachmentId]);
    await auditPort.record(actorUserId, 'attachment.delete', 'attachment', attachment.id, access.scopeNodeId, { resourceType: attachment.resource_type, resourceId: attachment.resource_id, fileName: attachment.file_name }, null);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[Attachments] Delete failed', error);
    return NextResponse.json({ error: 'ATTACHMENT_DELETE_FAILED' }, { status: 500 });
  }
});
