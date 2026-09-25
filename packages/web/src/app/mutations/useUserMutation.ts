"use client";

/** Owns the observable outcome of one user-initiated state change. */
import { useCallback, useRef, useState } from "react";
import type { ApiErrorResponse } from "@dashboard/core";
import { localizeUnknownError } from "@/app/errors/localizeApiError";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";

export type MutationFailureKind =
  | "validation"
  | "authorization"
  | "concurrency"
  | "not-found"
  | "infrastructure";

export type MutationStatus = "idle" | "pending" | "success" | "error";

export interface UserMutationFailure {
  kind: MutationFailureKind;
  message: string;
  retryable: boolean;
  /** Preserves the safe server contract for contextual UI such as delete restrictions. */
  apiError?: ApiErrorResponse;
}

export type UserMutationResult<T> = { ok: true; value: T } | { ok: false };

type MutationOperation<T> = () => Promise<T>;
type MutationSuccess<T> = (value: T) => void | Promise<void>;

/**
 * The only presentation lifecycle owner for a user operation: it absorbs a
 * rejection, exposes a localized error and retains the operation for safe
 * infrastructure retries. Callers therefore never discard a rejected promise.
 */
export function useUserMutation() {
  const { t } = useAppLocale();
  const [status, setStatus] = useState<MutationStatus>("idle");
  const [failure, setFailure] = useState<UserMutationFailure | null>(null);
  const retryOperation = useRef<MutationOperation<unknown> | null>(null);

  const execute = useCallback(async <T,>(
    operation: MutationOperation<T>,
    onSuccess?: MutationSuccess<T>,
  ): Promise<UserMutationResult<T>> => {
    const attempt = () => runUserMutationAttempt(operation, onSuccess);
    retryOperation.current = attempt as MutationOperation<unknown>;
    setStatus("pending");
    setFailure(null);
    const outcome = await runUserMutationOperation(attempt, t);
    if (outcome.ok) {
      retryOperation.current = null;
      setStatus("success");
      return outcome;
    }
    {
      const nextFailure = outcome.failure;
      retryOperation.current = nextFailure.retryable ? attempt as MutationOperation<unknown> : null;
      setFailure(nextFailure);
      setStatus("error");
      return { ok: false };
    }
  }, [t]);

  const reportValidationFailure = useCallback((message: string) => {
    retryOperation.current = null;
    setFailure({ kind: "validation", message, retryable: false });
    setStatus("error");
  }, []);

  const retry = useCallback(async (): Promise<UserMutationResult<unknown> | null> => {
    if (!retryOperation.current) return null;
    return execute(retryOperation.current);
  }, [execute]);

  const clear = useCallback(() => {
    retryOperation.current = null;
    setFailure(null);
    setStatus("idle");
  }, []);

  return {
    status,
    pending: status === "pending",
    failure,
    execute,
    retry,
    clear,
    reportValidationFailure,
  };
}

export function describeMutationFailure(
  reason: unknown,
  t: (key: string) => string,
): UserMutationFailure {
  const code = readErrorCode(reason);
  const kind = failureKindForCode(code);
  return {
    kind,
    message: localizeUnknownError(reason, t),
    retryable: kind === "infrastructure",
    apiError: isApiError(reason) ? reason : undefined,
  };
}

/** Converts every rejected mutation promise into a typed, visible outcome. */
export async function runUserMutationOperation<T>(
  operation: MutationOperation<T>,
  t: (key: string) => string,
): Promise<{ ok: true; value: T } | { ok: false; failure: UserMutationFailure }> {
  try {
    return { ok: true, value: await operation() };
  } catch (reason) {
    return { ok: false, failure: describeMutationFailure(reason, t) };
  }
}

/** Runs the successful completion together with its retriable user operation. */
export async function runUserMutationAttempt<T>(
  operation: MutationOperation<T>,
  onSuccess?: MutationSuccess<T>,
): Promise<T> {
  const value = await operation();
  await onSuccess?.(value);
  return value;
}

function readErrorCode(reason: unknown): string | undefined {
  if (!reason || typeof reason !== "object") return undefined;
  const code = Reflect.get(reason, "code");
  return typeof code === "string" ? code : undefined;
}

function failureKindForCode(code: string | undefined): MutationFailureKind {
  if (!code || code === "INTERNAL_ERROR") return "infrastructure";
  if (code === "ACCESS_FORBIDDEN" || code === "AUTH_UNAUTHORIZED" || code.endsWith("_FORBIDDEN")) return "authorization";
  if (code === "NOT_FOUND" || code.endsWith("_NOT_FOUND")) return "not-found";
  if (code.includes("LOCK") || code === "ROW_VERSION_MISMATCH") return "concurrency";
  return "validation";
}

export function isApiError(reason: unknown): reason is ApiErrorResponse {
  return Boolean(reason && typeof reason === "object" && typeof Reflect.get(reason, "code") === "string");
}
