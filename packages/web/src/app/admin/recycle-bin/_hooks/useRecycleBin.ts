'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { AppCache } from '../../../cache/GlobalCacheClient';
import type { DeletedEntityListItem, DeletedNodeListItem } from '../../../actions/recycleActions';

export type RecycleAction =
  | { kind: 'restore-entity' | 'purge-entity'; item: DeletedEntityListItem }
  | { kind: 'restore-node' | 'purge-node'; item: DeletedNodeListItem };

export function useRecycleBin() {
  const [entities, setEntities] = useState<DeletedEntityListItem[]>([]);
  const [nodes, setNodes] = useState<DeletedNodeListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<RecycleAction | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [entityResult, nodeResult] = await Promise.all([AppCache.admin.listDeletedEntities(), AppCache.admin.listDeletedNodes()]);
      if (entityResult.success) setEntities(entityResult.data);
      else setError(entityResult.error.message ?? 'Impossibile caricare le entità eliminate.');
      if (nodeResult.success) setNodes(nodeResult.data);
      else setError(nodeResult.error.message ?? 'Impossibile caricare i nodi eliminati.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const requestAction = useCallback((action: RecycleAction) => {
    setConfirmationText(''); setPendingAction(action);
  }, []);

  const closeAction = useCallback(() => {
    if (isPending) return;
    setPendingAction(null); setConfirmationText('');
  }, [isPending]);

  const confirmAction = useCallback(() => {
    if (!pendingAction) return;
    const action = pendingAction;
    const isPurge = action.kind.startsWith('purge-');
    if (isPurge && confirmationText !== 'ELIMINA DEFINITIVAMENTE') return;
    setPendingAction(null); setConfirmationText(''); setError(null);
    startTransition(async () => {
      const result = action.kind === 'restore-entity'
        ? await AppCache.admin.restoreDeletedEntity({ entityId: action.item.id, expectedRowVersion: action.item.rowVersion })
        : action.kind === 'purge-entity'
          ? await AppCache.admin.purgeDeletedEntity({ entityId: action.item.id, confirmation: 'ELIMINA DEFINITIVAMENTE' })
          : action.kind === 'restore-node'
            ? await AppCache.admin.restoreDeletedNode({ nodeId: action.item.id, expectedRowVersion: action.item.rowVersion })
            : await AppCache.admin.purgeDeletedNode({ nodeId: action.item.id, confirmation: 'ELIMINA DEFINITIVAMENTE' });
      if (result.success) await load();
      else setError(result.error?.message ?? 'Operazione sul cestino non riuscita.');
    });
  }, [confirmationText, load, pendingAction]);

  return { entities, nodes, error, loading, isPending, pendingAction, confirmationText, setConfirmationText, load, requestAction, closeAction, confirmAction };
}
