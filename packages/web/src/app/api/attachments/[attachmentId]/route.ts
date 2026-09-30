/** Decodes attachment download/deletion requests; application owns authorization and writes. */
import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { attachmentHttpError, attachmentIdentity, drainAttachmentEffects } from '../attachmentHttp';

const safeInlineTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export const GET = auth(async (request, context: { params: Promise<{ attachmentId: string }> }) => {
  try {
    const { actorUserId } = attachmentIdentity(request);
    const { attachmentService } = await import('../../../../server/db');
    const { attachment, content } = await attachmentService.download(actorUserId, (await context.params).attachmentId);
    const inline = safeInlineTypes.has(attachment.mimeType);
    return new Response(Buffer.from(content), { headers: {
      'Content-Type': inline ? attachment.mimeType : 'application/octet-stream',
      'Content-Length': String(content.byteLength),
      'Content-Disposition': (inline ? 'inline' : 'attachment') + '; filename="' + attachment.fileName.replace(/[\r\n"\\]/g, '_') + '"',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': inline ? "default-src 'none'; img-src 'self'" : "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'private, no-store',
    } });
  } catch (error) { return attachmentHttpError(error); }
});

export const DELETE = auth(async (request, context: { params: Promise<{ attachmentId: string }> }) => {
  try {
    const identity = attachmentIdentity(request);
    const { attachmentService } = await import('../../../../server/db');
    const result = await attachmentService.remove({ ...identity, attachmentId: (await context.params).attachmentId, expectedRowVersion: Number(request.headers.get('if-match')) });
    drainAttachmentEffects();
    return NextResponse.json(result);
  } catch (error) { return attachmentHttpError(error); }
});
