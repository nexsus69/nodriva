/** Formats the structured F-03 restriction without leaking technical details into the main message. */
export interface ResourceDeleteReferencer {
  domain: 'node' | 'entity';
  type: string;
  id: string;
  name: string;
  href?: string;
}

export interface ResourceDeleteErrorLike {
  code?: unknown;
  message?: unknown;
  totalReferencerCount?: unknown;
  referencers?: unknown;
}

export interface ResourceDeleteRestriction {
  message: string;
  totalReferencerCount: number;
  referencers: ResourceDeleteReferencer[];
}

export function getResourceDeleteRestriction(error: ResourceDeleteErrorLike): ResourceDeleteRestriction | null {
  const message = typeof error.message === 'string' && error.message.trim()
    ? error.message
    : 'Impossibile eliminare la risorsa perché possiede riferimenti attivi.';
  if (error.code !== 'RESOURCE_DELETE_RESTRICTED') return null;

  const total = typeof error.totalReferencerCount === 'number' && Number.isFinite(error.totalReferencerCount)
    ? error.totalReferencerCount
    : 0;
  const referencers = Array.isArray(error.referencers)
    ? error.referencers.flatMap((value): ResourceDeleteReferencer[] => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const item = value as Record<string, unknown>;
      const domain = item.domain === 'node' || item.domain === 'entity' ? item.domain : null;
      return domain && typeof item.type === 'string' && typeof item.id === 'string' && typeof item.name === 'string'
        ? [{ domain, type: item.type, id: item.id, name: item.name, ...(typeof item.href === 'string' ? { href: item.href } : {}) }]
        : [];
    })
    : [];

  return { message, totalReferencerCount: total, referencers };
}

export function formatResourceDeleteError(error: ResourceDeleteErrorLike): string {
  return getResourceDeleteRestriction(error)?.message
    ?? (typeof error.message === 'string' && error.message.trim() ? error.message : 'Impossibile eliminare la risorsa.');
}
