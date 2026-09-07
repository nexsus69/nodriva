import { AppError } from './AppError.js';

/** A live canonical edge from outside the deletion set prevents soft deletion. */
export class ResourceDeleteRestrictedError extends AppError {
  constructor(resourceDomain: 'node' | 'entity', resourceId: string, totalReferencerCount: number, referencers: readonly { domain: 'node' | 'entity'; id: string; type: string; name: string; parentNodeId?: string | null }[] = []) {
    super(
      'RESOURCE_DELETE_RESTRICTED',
      'The resource cannot be deleted while active relationships reference it.',
      { resourceDomain, resourceId, totalReferencerCount, referencers },
    );
  }
}
