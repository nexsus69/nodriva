/** Maps attachment application errors and schedules optional post-commit delivery. */
import { AppError } from '@dashboard/core';
import { NextResponse } from 'next/server';

export function attachmentIdentity(request: { auth?: { userId?: string; activitySessionId?: string } | null; headers?: Headers }) {
  const actorUserId = request.auth?.userId;
  const actorSessionId = request.auth?.activitySessionId;
  if (!actorUserId || !actorSessionId) throw new AppError('AUTH_UNAUTHORIZED', 'Session expired');
  const mutationId = request.headers?.get('x-mutation-id') ?? undefined;
  if (mutationId && mutationId.length > 200) throw new AppError('VALIDATION_FAILED', 'Invalid mutation identifier');
  return { actorUserId, actorSessionId, mutationId };
}

export function attachmentHttpError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const code = error.code === 'ACCESS_FORBIDDEN' ? 'RESOURCE_NOT_FOUND' : error.code;
    const status = code === 'AUTH_UNAUTHORIZED' ? 401
      : ['RESOURCE_NOT_FOUND', 'ATTACHMENT_NOT_FOUND', 'ATTACHMENT_CONTENT_NOT_FOUND'].includes(code) ? 404
      : ['ROW_VERSION_MISMATCH', 'LOCK_CONFLICT', 'LOCK_NOT_FOUND', 'LOCK_EXPIRED', 'ATTACHMENT_POLICY_CHANGED'].includes(code) ? 409
      : ['ATTACHMENT_TOO_LARGE', 'ATTACHMENT_QUOTA_EXCEEDED'].includes(code) ? 413
      : code === 'ATTACHMENT_RATE_LIMITED' ? 429
      : code === 'ATTACHMENT_SCANNER_UNAVAILABLE' ? 503
      : code === 'ATTACHMENT_INFECTED' ? 422
      : code === 'ATTACHMENT_CONTENT_TYPE_MISMATCH' ? 415 : 400;
    return NextResponse.json({ error: code, ...(error.code === 'ROW_VERSION_MISMATCH' ? { currentRowVersion: error.details?.actual } : {}) }, { status });
  }
  console.error('[Attachments] Unexpected failure', error);
  return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
}

export function drainAttachmentEffects(): void {
  void Promise.all([
    import('../../../server/db').then(({ attachmentCleanupService }) => attachmentCleanupService.drain()),
    import('../../../server/realtime').then(({ drainRealtimeOutbox }) => drainRealtimeOutbox()),
  ]).catch((error) => console.error('[Attachments] Post-commit delivery failed; durable work retained', error));
}
