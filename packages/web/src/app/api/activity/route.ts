import { AppError } from '@dashboard/core';
import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { validateLockResource } from '../../actions/lockResourceValidation';

const MAX_ACTIVE_LOCKS = 4;

interface ActivityLockPayload {
  resourceType: 'node' | 'entity';
  resourceId: string;
}

function parseActiveLocks(value: unknown): ActivityLockPayload[] | null {
  if (!Array.isArray(value) || value.length > MAX_ACTIVE_LOCKS) return null;
  const locks: ActivityLockPayload[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const resourceType = Reflect.get(item, 'resourceType');
    const resourceId = Reflect.get(item, 'resourceId');
    if (typeof resourceType !== 'string' || typeof resourceId !== 'string') return null;
    let validatedType: ActivityLockPayload['resourceType'];
    try {
      validatedType = validateLockResource(resourceType, resourceId);
    } catch {
      return null;
    }
    const key = `${validatedType}:${resourceId}`;
    if (!seen.has(key)) locks.push({ resourceType: validatedType, resourceId });
    seen.add(key);
  }
  return locks;
}

function authenticatedIdentity(request: { auth?: { userId?: string; activitySessionId?: string } | null }) {
  const userId = request.auth?.userId;
  const sessionId = request.auth?.activitySessionId;
  return typeof userId === 'string' && typeof sessionId === 'string'
    ? { userId, sessionId }
    : null;
}

function activityError(error: unknown): NextResponse {
  if (error instanceof AppError && error.code === 'AUTH_UNAUTHORIZED') {
    return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });
  }
  console.error('[Activity] Unexpected error:', error);
  return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
}

function serializeTiming(timing: {
  sessionIdleTimeoutSeconds: number;
  sessionUpdateAgeSeconds: number;
  lockTtlSeconds: number;
  syncPollingIntervalSeconds: number;
}) {
  return timing;
}

export const GET = auth(async (request) => {
  const identity = authenticatedIdentity(request);
  if (!identity) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });

  try {
    const { humanActivityService } = await import('../../../server/db');
    const result = await humanActivityService.getStatus(identity.sessionId, identity.userId);
    return NextResponse.json(
      { sessionExpiresAt: result.sessionExpiresAt.toISOString(), timing: serializeTiming(result.timing) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return activityError(error);
  }
});

export const POST = auth(async (request) => {
  const identity = authenticatedIdentity(request);
  if (!identity) return NextResponse.json({ error: 'SESSION_EXPIRED' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }
  const activeLocks = parseActiveLocks(
    body && typeof body === 'object' ? Reflect.get(body, 'activeLocks') : undefined,
  );
  if (!activeLocks) return NextResponse.json({ error: 'INVALID_LOCKS' }, { status: 400 });

  try {
    const { humanActivityService } = await import('../../../server/db');
    const result = await humanActivityService.recordActivity(
      identity.sessionId,
      identity.userId,
      activeLocks,
    );
    return NextResponse.json({
      sessionExpiresAt: result.sessionExpiresAt.toISOString(),
      renewedLocks: result.renewedLocks.map((lock) => ({
        ...lock,
        expiresAt: lock.expiresAt.toISOString(),
      })),
      timing: serializeTiming(result.timing),
    });
  } catch (error) {
    return activityError(error);
  }
});
