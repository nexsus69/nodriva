/** Coordinates node detail state, cache reads, lock state and user-driven mutations. */

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSemanticNodeList } from '../../../hooks/useSemanticNodeList';
import { useSemanticEntityCollection } from '../../../hooks/useSemanticEntityCollection';
import { useSemanticMetadata } from '../../../hooks/useSemanticMetadata';
import { useCacheNode } from '../../../hooks/useCacheNode';
import { useLock } from '../../../hooks/useLock';
import { AppCache, isRowVersionMismatch } from '../../../cache/GlobalCacheClient';
import { uploadDynamicAttachments } from '../../../components/ui/forms/dynamicResourceForm';
import { checkNodeReadAccessAction } from '../../../actions/nodeActions';
import { useUnsavedChanges } from '../../../navigation/NavigationBlocker';
import { areFormValuesEqual, hasSelectedFiles } from '../../../navigation/unsavedChanges';
import { resolveNodeAccess, type NodeAccessState } from './nodeAccessState';
import { requestConfirmation } from '../../../components/ui/feedback/ConfirmDialogStore';
import { useDeletionReturnContext } from '../../../navigation/returnContext';
import { formatResourceDeleteError, getResourceDeleteRestriction, type ResourceDeleteRestriction } from '../../../errors/resourceDeleteError';
import { publishMutationSuccess } from '../../../mutations/MutationOutcomeStore';
import {
  abandonConcurrentEdit,
  acceptConcurrentEditVersion,
  beginConcurrentEdit,
  canSubmitConcurrentEdit,
  IDLE_CONCURRENT_EDIT,
  reconcileConcurrentEdit,
} from '../../../editing/ConcurrentEditLifecycle';

export type DynamicNodeField = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>['fields'][number];
export type EntityTypeDefinition = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>;

export interface NodeDetailNavigation {
  afterDelete: string;
  detailPath: string;
}

export function useNodeDetail(nodeId: string, navigation?: NodeDetailNavigation) {
  const router = useRouter();
  const [nodeAccessResult, setNodeAccessResult] = useState<{ nodeId: string; state: NodeAccessState }>({ nodeId, state: 'checking' });
  const nodeAccess = nodeAccessResult.nodeId === nodeId ? nodeAccessResult.state : 'checking';
  const [nodeAccessAttempt, setNodeAccessAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteRestriction, setDeleteRestriction] = useState<ResourceDeleteRestriction | null>(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeDescription, setNodeDescription] = useState('');
  const [dynamicNodeFields, setDynamicNodeFields] = useState<DynamicNodeField[]>([]);
  const [dynamicNodePayload, setDynamicNodePayload] = useState<Record<string, unknown>>({});
  const [attachmentsByField, setAttachmentsByField] = useState<Record<string, readonly File[]>>({});
  const [editLifecycle, setEditLifecycle] = useState(IDLE_CONCURRENT_EDIT);
  const [entityDefinitions, setEntityDefinitions] = useState<Record<string, EntityTypeDefinition>>({});
  const [isSavingNode, startNodeUpdate] = useTransition();

  const { nodes: childNodes, isLoading: isChildrenLoading, error: childrenError } = useSemanticNodeList(nodeId, { retentionClass: 'persistent' });
  const { entities: nodeEntities, isLoading: isEntitiesLoading, error: entitiesError } = useSemanticEntityCollection(nodeId);
  const { entityTypes, nodeTypes } = useSemanticMetadata();
  const lock = useLock({ resourceType: 'node', resourceId: nodeId });
  const { data: currentNode, error: nodeError, isLoading: isLoadingNode } = useCacheNode(nodeId);
  const reconciledEditLifecycle = reconcileConcurrentEdit(editLifecycle, {
    ownsLock: lock.isMyLock,
    currentRowVersion: currentNode?.rowVersion,
    mutationPending: AppCache.mutations.isPending(`node:${nodeId}`),
    currentVersionIsLocal: currentNode ? AppCache.mutations.isLocalVersion(`node:${nodeId}`, currentNode.rowVersion) : false,
  });
  const formStale = reconciledEditLifecycle.stale;
  const deletionFallback = navigation?.afterDelete ?? (currentNode?.parentId ? `/nodes/${currentNode.parentId}` : '/');
  const deletionReturnTo = useDeletionReturnContext(deletionFallback, navigation?.detailPath ?? `/nodes/${nodeId}`);
  const readOnly = !lock.isMyLock;
  const hasUnsavedChanges = Boolean(lock.isMyLock && currentNode && (
    nodeName !== currentNode.name
    || nodeDescription !== (currentNode.description || '')
    || !areFormValuesEqual(dynamicNodePayload, currentNode.payload ?? {})
    || hasSelectedFiles(attachmentsByField)
  ));
  const navigationGuard = useUnsavedChanges(hasUnsavedChanges);

  useEffect(() => {
    let cancelled = false;
    void resolveNodeAccess(() => checkNodeReadAccessAction(nodeId))
      .then((access) => { if (!cancelled) setNodeAccessResult({ nodeId, state: access }); });
    return () => { cancelled = true; };
  }, [nodeAccessAttempt, nodeId]);

  const retryNodeAccess = () => {
    setNodeAccessResult({ nodeId, state: 'checking' });
    setNodeAccessAttempt((attempt) => attempt + 1);
  };

  useEffect(() => {
    const nodeTypeKey = currentNode ? nodeTypes[currentNode.nodeTypeId]?.typeKey : undefined;
    if (!currentNode || !nodeTypeKey || lock.isMyLock) return;
    const timer = window.setTimeout(() => {
      AppCache.admin.getTypeDefinition('node', nodeTypeKey).then((definition) => {
        setDynamicNodeFields(definition?.fields ?? []);
        setDynamicNodePayload(currentNode.payload ?? {});
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentNode, lock.isMyLock, nodeTypes]);

  const entityTypeKeys = [...new Set(
    nodeEntities.map((entity) => entityTypes[entity.entityTypeId]?.typeKey).filter(Boolean),
  )].sort();
  const entityTypeKeysSignature = entityTypeKeys.join('|');

  useEffect(() => {
    const typeKeys = entityTypeKeysSignature ? entityTypeKeysSignature.split('|') : [];
    if (typeKeys.length === 0) return;
    let cancelled = false;
    Promise.all(typeKeys.map((typeKey) => AppCache.admin.getTypeDefinition('entity', typeKey)))
      .then((definitions) => {
        if (cancelled) return;
        setEntityDefinitions(Object.fromEntries(
          definitions.filter((definition): definition is EntityTypeDefinition => Boolean(definition))
            .map((definition) => [definition.typeKey, definition]),
        ));
      })
      .catch((cause: unknown) => { if (!cancelled) AppCache.handleFetchError(cause); });
    return () => { cancelled = true; };
  }, [entityTypeKeysSignature]);

  const beginNodeEditing = async (): Promise<boolean> => {
    if (!currentNode) return false;
    setErrorMessage(null);
    setNodeName(currentNode.name);
    setNodeDescription(currentNode.description || '');
    setDynamicNodePayload(currentNode.payload ?? {});
    setAttachmentsByField({});
    setEditLifecycle(beginConcurrentEdit(currentNode.rowVersion));
    return lock.acquireLock();
  };

  const exitEditMode = async () => {
    if (!(await navigationGuard.confirmDiscard())) return;
    if (currentNode) {
      setNodeName(currentNode.name);
      setNodeDescription(currentNode.description || '');
      setDynamicNodePayload(currentNode.payload ?? {});
    }
    setAttachmentsByField({});
    setEditLifecycle(abandonConcurrentEdit());
    await lock.releaseLock();
  };

  const reloadFresh = async () => {
    const refreshed = await AppCache.refreshNode(nodeId);
    if (!refreshed) return;
    setNodeName(refreshed.name); setNodeDescription(refreshed.description || ''); setDynamicNodePayload(refreshed.payload ?? {}); setAttachmentsByField({});
    setEditLifecycle(acceptConcurrentEditVersion(refreshed.rowVersion));
    setErrorMessage('Dati aggiornati. Puoi continuare la modifica.');
  };

  const handleUpdateNode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentNode || !lock.isMyLock) return;
    if (!canSubmitConcurrentEdit(reconciledEditLifecycle, currentNode.rowVersion)) return;
    setErrorMessage(null);
    startNodeUpdate(async () => {
      try {
        const updatedNode = await AppCache.updateNode({
          nodeId,
          name: nodeName.trim(),
          description: nodeDescription.trim(),
          expectedRowVersion: currentNode.rowVersion,
          payloadDelta: dynamicNodePayload,
        });
        // The local mutation response is authoritative. Advance the editing
        // snapshot before the asynchronous lock release can trigger a render.
        setEditLifecycle(acceptConcurrentEditVersion(updatedNode.rowVersion));
        await uploadDynamicAttachments('node', nodeId, dynamicNodeFields, attachmentsByField, {
          expectedRowVersion: updatedNode.rowVersion,
          onUploaded: (version, fieldKey, file) => {
            setEditLifecycle(acceptConcurrentEditVersion(version));
            setAttachmentsByField((current) => ({ ...current, [fieldKey]: (current[fieldKey] ?? []).filter((candidate) => candidate !== file) }));
          },
        });
        setAttachmentsByField({});
        await lock.releaseLock();
        publishMutationSuccess('mutation.updated');
      } catch (cause) {
        if (isRowVersionMismatch(cause)) {
          const refreshed = await AppCache.refreshNode(nodeId);
          if (refreshed) {
            setNodeName(refreshed.name);
            setNodeDescription(refreshed.description || '');
            setDynamicNodePayload(refreshed.payload ?? {});
            setAttachmentsByField({});
            setEditLifecycle(acceptConcurrentEditVersion(refreshed.rowVersion));
            setErrorMessage('I dati sono stati aggiornati da un altro utente. I campi sono stati ricaricati; puoi continuare la modifica o uscire intenzionalmente.');
            return;
          }
        }
        setErrorMessage(cause instanceof Error ? `Errore durante l'aggiornamento del nodo: ${cause.message}` : `Errore durante l'aggiornamento del nodo.`);
      }
    });
  };

  const requestDeleteNode = async () => {
    if (!currentNode) return;
    const confirmed = await requestConfirmation({
      title: 'Eliminare il nodo e il suo contenuto?',
      description: 'Il nodo, tutti i sotto-nodi e le entità contenute verranno spostati nel cestino.',
      confirmLabel: 'Elimina nodo',
      cancelLabel: 'Annulla',
      tone: 'danger',
    });
    if (!confirmed) return;
    if (!lock.isMyLock && !(await beginNodeEditing())) return;

    const nodeToDelete = currentNode;
    setDeleteRestriction(null);
    startNodeUpdate(async () => {
      try {
        await AppCache.deleteNode(nodeToDelete.id, nodeToDelete.rowVersion);
        navigationGuard.allowNavigation();
        router.push(deletionReturnTo);
      } catch (cause) {
        setErrorMessage(cause instanceof Error
          ? `Errore durante l'eliminazione del nodo: ${formatResourceDeleteError(cause as Error & { code?: unknown; totalReferencerCount?: unknown; referencers?: unknown })}`
          : 'Errore durante l’eliminazione del nodo.');
        setDeleteRestriction(cause instanceof Error ? getResourceDeleteRestriction(cause as Error & { code?: unknown; totalReferencerCount?: unknown; referencers?: unknown }) : null);
      }
    });
  };

  const displayedError = formStale
    ? 'I dati sono cambiati in un’altra sessione. Ricaricali prima di salvare.'
    : errorMessage
    ?? (childrenError ? `Errore nel caricamento del nodo: ${childrenError.message}`
      : entitiesError ? `Errore nel caricamento delle entità: ${entitiesError.message}` : null);
  const nodeErrorCode = (nodeError as (Error & { code?: string }) | null)?.code;
  const nodeAccessDenied = nodeErrorCode === 'ACCESS_FORBIDDEN'
    || nodeError?.message.includes('Non disponi dei permessi necessari')
    || nodeError?.message.includes('does not have permission');

  return {
    attachmentVersion: reconciledEditLifecycle.baselineRowVersion ?? currentNode?.rowVersion,
    acceptAttachmentVersion: (version: number) => setEditLifecycle(acceptConcurrentEditVersion(version)),
    nodeAccess, retryNodeAccess, nodeAccessDenied, currentNode, childNodes, nodeEntities, entityTypes, nodeTypes, entityDefinitions,
    isChildrenLoading, isEntitiesLoading, isNodeLoading: isLoadingNode || !currentNode, displayedError, deleteRestriction,
    dynamicNodeFields, dynamicNodePayload, attachmentsByField, nodeName, nodeDescription, isSavingNode, formStale, reloadFresh,
    readOnly, lockedByOther: lock.lockedByOther, isMyLock: lock.isMyLock, lockError: lock.error,
    setDynamicNodePayload, setAttachmentsByField, setNodeName, setNodeDescription,
    beginNodeEditing, exitEditMode, handleUpdateNode,
    requestDeleteNode,
  };
}
