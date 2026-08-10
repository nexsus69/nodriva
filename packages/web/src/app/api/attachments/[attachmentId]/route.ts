import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { authenticatedUser, assertAttachmentAccess } from '../attachmentAccess';

type AttachmentRow = { id: string; resource_type: 'node' | 'entity'; resource_id: string; file_name: string; mime_type: string; storage_key: string };

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
    if (!(await assertAttachmentAccess(actorUserId, attachment.resource_type, attachment.resource_id))) return NextResponse.json({ error: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    const { attachmentStorage } = await import('../../../../server/db');
    const content = await attachmentStorage.get(attachment.storage_key);
    if (!content) return NextResponse.json({ error: 'ATTACHMENT_CONTENT_NOT_FOUND' }, { status: 404 });
    return new Response(Buffer.from(content), { headers: { 'Content-Type': attachment.mime_type, 'Content-Disposition': `inline; filename="${attachment.file_name.replace(/"/g, '')}"`, 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[Attachments] Download failed', error);
    return NextResponse.json({ error: 'ATTACHMENT_DOWNLOAD_FAILED' }, { status: 500 });
  }
});
