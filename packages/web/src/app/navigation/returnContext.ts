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

/**
 * Resolves a post-deletion destination without returning to a route that was
 * removed by the mutation. The fallback must identify the closest valid view.
 */
export function resolveDeletionReturnContext(
  returnTo: string | null | undefined,
  fallback: string,
  deletedRoute: string,
): string {
  const resolved = resolveReturnContext(returnTo, fallback);
  const deleted = toInternalPath(deletedRoute);
  if (!deleted) return resolved;
  const originPath = new URL(resolved, internalOrigin).pathname;
  const deletedPath = new URL(deleted, internalOrigin).pathname;
  return originPath === deletedPath || originPath.startsWith(`${deletedPath}/`)
    ? resolveReturnContext(null, fallback)
    : resolved;
}

/** Builds a routed creation href that returns to the exact visible page, including its query state. */
export function useNavigationHref(destination: string): string {
  const origin = useCurrentInternalPath();
  return useMemo(() => withReturnContext(destination, origin), [destination, origin]);
}

/** Returns the current validated route, including query state, for local workflow actions. */
export function useCurrentInternalPath(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  return useMemo(
    () => toInternalPath(`${pathname ?? '/'}${search ? `?${search}` : ''}`) ?? '/',
    [pathname, search],
  );
}

/** Backward-compatible name for routed flows that create a resource. */
export const useCreationHref = useNavigationHref;

/** Reads the origin encoded by a routed flow while keeping direct-entry fallback explicit. */
export function useReturnContext(fallback: string): string {
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get(RETURN_TO_PARAMETER) ?? null;
  return useMemo(() => resolveReturnContext(returnTo, fallback), [fallback, returnTo]);
}

/** Reads a return origin while excluding the route hierarchy just deleted. */
export function useDeletionReturnContext(fallback: string, deletedRoute: string): string {
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get(RETURN_TO_PARAMETER) ?? null;
  return useMemo(
    () => resolveDeletionReturnContext(returnTo, fallback, deletedRoute),
    [deletedRoute, fallback, returnTo],
  );
}
