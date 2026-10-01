import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { resourceReference } from '@dashboard/core';
import { validateLockResource } from '../../../actions/lockResourceValidation';

export const POST = auth(async (request) => {
  const userId = request.auth?.userId;
  const sessionId = request.auth?.activitySessionId;
  if (typeof userId !== 'string' || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const resourceType = body && typeof body === 'object' ? Reflect.get(body, 'resourceType') : undefined;
  const resourceId = body && typeof body === 'object' ? Reflect.get(body, 'resourceId') : undefined;
  const lockId = body && typeof body === 'object' ? Reflect.get(body, 'lockId') : undefined;
  if (typeof resourceType !== 'string' || typeof resourceId !== 'string') {
    return NextResponse.json({ error: 'INVALID_RESOURCE' }, { status: 400 });
  }
  if (lockId !== undefined && (typeof lockId !== 'string' || lockId.length > 200)) {
    return NextResponse.json({ error: 'INVALID_LOCK' }, { status: 400 });
  }

  let validatedType: ReturnType<typeof validateLockResource>;
  try {
    validatedType = validateLockResource(resourceType, resourceId);
  } catch {
    return NextResponse.json({ error: 'INVALID_RESOURCE' }, { status: 400 });
  }

  try {
    const { lockService } = await import('../../../../server/db');
    await lockService.unlock(resourceReference(validatedType, resourceId), userId, sessionId, undefined, lockId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LockRelease] Failed to release page-exit lock:', error);
    return NextResponse.json({ error: 'LOCK_RELEASE_FAILED' }, { status: 500 });
  }
});
