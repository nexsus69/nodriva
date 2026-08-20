import type { ApiErrorResponse } from '@dashboard/core';

type ErrorReporter = (message: string, reason: unknown) => void;

function hasSafeErrorShape(reason: unknown): reason is ApiErrorResponse {
  return Boolean(
    reason
    && typeof reason === 'object'
    && typeof Reflect.get(reason, 'code') === 'string'
    && typeof Reflect.get(reason, 'message') === 'string',
  );
}

/** Keeps errors already sanitized by a Server Action and hides unexpected
 * transport/runtime details behind a stable client-facing fallback. */
export function toClientErrorResponse(
  reason: unknown,
  fallbackMessage: string,
  report: ErrorReporter = (message, unexpected) => console.error(message, unexpected),
): ApiErrorResponse {
  if (hasSafeErrorShape(reason)) return reason;
  report('[ClientError] Unexpected client or transport error:', reason);
  return { code: 'INTERNAL_ERROR', message: fallbackMessage };
}
