'use client';

/** Executes the canonical soft-delete flow available from every resource menu. */
import { useRouter } from 'next/navigation';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { requestConfirmation } from '../feedback/ConfirmDialogStore';
import { useNavigationConfirmation } from '../../../navigation/NavigationBlocker';
import { resolveDeletionReturnContext, useCurrentInternalPath } from '../../../navigation/returnContext';
import { getResourceDeleteRestriction, type ResourceDeleteRestriction } from '../../../errors/resourceDeleteError';
import { useUserMutation } from '../../../mutations/useUserMutation';

type ResourceMenuDeleteInput =
  | { kind: 'node'; resourceId: string }
  | { kind: 'entity'; resourceId: string; parentNodeId: string };

interface ResourceMenuDeleteResult {
  requestDelete: () => Promise<void>;
  isDeleting: boolean;
  errorMessage: string | null;
  retryDelete: () => void;
  canRetry: boolean;
  deleteRestriction: ResourceDeleteRestriction | null;
}

/**
 * Uses the resource UUID as the client contract. The Server Action resolves the
 * current row version and briefly owns a lock when the deployment enables it.
 */
export function useResourceMenuDelete(input: ResourceMenuDeleteInput): ResourceMenuDeleteResult {
  const router = useRouter();
  const origin = useCurrentInternalPath();
  const confirmNavigation = useNavigationConfirmation();
  const mutation = useUserMutation();
  const deleteRestriction = getResourceDeleteRestriction(mutation.failure?.apiError ?? {});

  const requestDelete = async () => {
    const isNode = input.kind === 'node';
    const confirmed = await requestConfirmation({
      title: isNode ? 'Eliminare il nodo e il suo contenuto?' : 'Elimina entità?',
      description: isNode
        ? 'Il nodo, tutti i sotto-nodi e le entità contenute verranno spostati nel cestino.'
        : 'L’entità verrà spostata nel cestino.',
      confirmLabel: isNode ? 'Elimina nodo' : 'Elimina entità',
      cancelLabel: 'Annulla',
      tone: 'danger',
    });
    if (!confirmed || !(await confirmNavigation())) return;

    const outcome = await mutation.execute(async () => {
      const deleted = isNode
        ? await AppCache.deleteNode(input.resourceId)
        : await AppCache.deleteEntity(input.resourceId);
      const fallback = isNode
        ? (deleted.parentNodeId ? `/nodes/${deleted.parentNodeId}` : '/')
        : `/nodes/${deleted.parentNodeId}`;
      const deletedRoute = isNode
        ? `/nodes/${input.resourceId}`
        : `/nodes/${input.parentNodeId}/entities/${input.resourceId}`;
      const destination = resolveDeletionReturnContext(origin, fallback, deletedRoute);
      if (destination === origin) router.refresh();
      else router.push(destination);
    });
    void outcome;
  };

  return { requestDelete, isDeleting: mutation.pending, errorMessage: mutation.failure?.message ?? null, retryDelete: () => void mutation.retry(), canRetry: Boolean(mutation.failure?.retryable), deleteRestriction };
}
