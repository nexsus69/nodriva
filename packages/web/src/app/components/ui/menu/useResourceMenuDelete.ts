'use client';

/** Executes the canonical soft-delete flow available from every resource menu. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { requestConfirmation } from '../feedback/ConfirmDialogStore';
import { useNavigationConfirmation } from '../../../navigation/NavigationBlocker';
import { resolveDeletionReturnContext, useCurrentInternalPath } from '../../../navigation/returnContext';

type ResourceMenuDeleteInput =
  | { kind: 'node'; resourceId: string }
  | { kind: 'entity'; resourceId: string; parentNodeId: string };

interface ResourceMenuDeleteResult {
  requestDelete: () => Promise<void>;
  isDeleting: boolean;
  errorMessage: string | null;
}

/**
 * Uses the resource UUID as the client contract. The Server Action resolves the
 * current row version and briefly owns a lock when the deployment enables it.
 */
export function useResourceMenuDelete(input: ResourceMenuDeleteInput): ResourceMenuDeleteResult {
  const router = useRouter();
  const origin = useCurrentInternalPath();
  const confirmNavigation = useNavigationConfirmation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    setIsDeleting(true);
    setErrorMessage(null);
    try {
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Non è stato possibile eliminare la risorsa.');
    } finally {
      setIsDeleting(false);
    }
  };

  return { requestDelete, isDeleting, errorMessage };
}
