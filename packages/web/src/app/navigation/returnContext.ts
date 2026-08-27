'use client';

/** Preserves a validated in-app origin for any routed creation or detail flow. */
import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export const RETURN_TO_PARAMETER = 'returnTo';
const internalOrigin = 'https://nodriva.invalid';

/** Rejects external, protocol-relative and malformed targets before client navigation. */
export function toInternalPath(value: string | null | undefined): string | null {
  if (!value?.startsWith('/') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(value, internalOrigin);
    if (parsed.origin !== internalOrigin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/** Adds the current origin to an internal destination without letting it replace that destination. */
export function withReturnContext(destination: string, origin: string): string {
  const safeDestination = toInternalPath(destination);
  const safeOrigin = toInternalPath(origin);
  if (!safeDestination) throw new Error('A routed creation destination must be an internal path.');
  if (!safeOrigin) return safeDestination;
  const target = new URL(safeDestination, internalOrigin);
  target.searchParams.set(RETURN_TO_PARAMETER, safeOrigin);
  return `${target.pathname}${target.search}${target.hash}`;
}

/** Resolves the validated origin, retaining a deterministic local fallback for direct URLs. */
export function resolveReturnContext(returnTo: string | null | undefined, fallback: string): string {
  return toInternalPath(returnTo) ?? toInternalPath(fallback) ?? '/';
}

/** Builds a routed creation href that returns to the exact visible page, including its query state. */
export function useCreationHref(destination: string): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  return useMemo(
    () => withReturnContext(destination, `${pathname ?? '/'}${search ? `?${search}` : ''}`),
    [destination, pathname, search],
  );
}

/** Reads the origin encoded by a routed flow while keeping direct-entry fallback explicit. */
export function useReturnContext(fallback: string): string {
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get(RETURN_TO_PARAMETER) ?? null;
  return useMemo(() => resolveReturnContext(returnTo, fallback), [fallback, returnTo]);
}
