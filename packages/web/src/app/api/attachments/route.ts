/** Decodes attachment collection HTTP requests into application commands. */
import { NextResponse } from 'next/server';
import { defaultAttachmentSecurityPolicy } from '@dashboard/core/browser';
import { auth } from '../../../auth';
import { parseAttachmentTarget } from './attachmentAccess';
import { attachmentHttpError, attachmentIdentity, drainAttachmentEffects } from './attachmentHttp';

export const GET = auth(async (request) => {
  try {
    const { actorUserId } = attachmentIdentity(request);
    const url = new URL(request.url);
    const target = parseAttachmentTarget({ resourceType: url.searchParams.get('resourceType') ?? '', resourceId: url.searchParams.get('resourceId') ?? '', fieldKey: url.searchParams.get('fieldKey') ?? 'attachments', kind: url.searchParams.get('kind') ?? 'file' });
    if (!target) return NextResponse.json({ error: 'INVALID_ATTACHMENT_TARGET' }, { status: 400 });
    const { attachmentService } = await import('../../../server/db');
    return NextResponse.json(await attachmentService.list(actorUserId, target));
  } catch (error) { return attachmentHttpError(error); }
});

export const POST = auth(async (request) => {
  try {
    const identity = attachmentIdentity(request);
    if (Number(request.headers.get('content-length')) > defaultAttachmentSecurityPolicy.maxFileSizeBytes + 1024 * 1024) return NextResponse.json({ error: 'ATTACHMENT_TOO_LARGE' }, { status: 413 });
    let form: FormData;
    try { form = await request.formData(); }
    catch { return NextResponse.json({ error: 'INVALID_ATTACHMENT_REQUEST' }, { status: 400 }); }
    const file = form.get('file');
    const target = parseAttachmentTarget({ resourceType: form.get('resourceType') ?? '', resourceId: form.get('resourceId') ?? '', fieldKey: form.get('fieldKey') ?? '', kind: form.get('kind') ?? '' });
    if (!target || !(file instanceof File)) return NextResponse.json({ error: 'INVALID_ATTACHMENT_REQUEST' }, { status: 400 });
    if (file.size > defaultAttachmentSecurityPolicy.maxFileSizeBytes) return NextResponse.json({ error: 'ATTACHMENT_TOO_LARGE' }, { status: 413 });
    const { attachmentService } = await import('../../../server/db');
    const result = await attachmentService.upload({ ...identity, ...target, expectedRowVersion: Number(form.get('expectedRowVersion')), fileName: file.name, mimeType: file.type || 'application/octet-stream', content: new Uint8Array(await file.arrayBuffer()) });
    drainAttachmentEffects();
    return NextResponse.json(result);
  } catch (error) { return attachmentHttpError(error); }
});
