/** Coordinates node detail state, cache reads, lock state and user-driven mutations. */

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSemanticNodeList } from '../../../hooks/useSemanticNodeList';
import { useSemanticEntityCollection } from '../../../hooks/useSemanticEntityCollection';
import { useSemanticMetadata } from '../../../hooks/useSemanticMetadata';
import { useCacheNode } from '../../../hooks/useCacheNode';
import { useLock } from '../../../hooks/useLock';
import { AppCache, hasStaleOptimisticEdit, isRowVersionMismatch } from '../../../cache/GlobalCacheClient';
import { uploadResourceAttachment } from '../../../attachments/attachmentClient';
import { checkNodeReadAccessAction } from '../../../actions/nodeActions';
import { useUnsavedChanges } from '../../../navigation/NavigationBlocker';
import { areFormValuesEqual, hasSelectedFiles } from '../../../navigation/unsavedChanges';
import { resolveNodeAccess, type NodeAccessState } from './nodeAccessState';
import { requestConfirmation } from '../../../components/ui/feedback/ConfirmDialogStore';
import { useDeletionReturnContext } from '../../../navigation/returnContext';

export type DynamicNodeField = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>['fields'][number];
export type EntityTypeDefinition = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>;

export function useNodeDetail(nodeId: string) {
  const router = useRouter();
  const [nodeAccessResult, setNodeAccessResult] = useState<{ nodeId: string; state: NodeAccessState }>({ nodeId, state: 'checking' });
  const nodeAccess = nodeAccessResult.nodeId === nodeId ? nodeAccessResult.state : 'checking';
  const [nodeAccessAttempt, setNodeAccessAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeDescription, setNodeDescription] = useState('');
  const [dynamicNodeFields, setDynamicNodeFields] = useState<DynamicNodeField[]>([]);
  const [dynamicNodePayload, setDynamicNodePayload] = useState<Record<string, unknown>>({});
  const [attachmentsByField, setAttachmentsByField] = useState<Record<string, readonly File[]>>({});
  const editingRowVersion = useRef<number | null>(null);
  const [formStale, setFormStale] = useState(false);
  const [entityDefinitions, setEntityDefinitions] = useState<Record<string, EntityTypeDefinition>>({});
  const [isSavingNode, startNodeUpdate] = useTransition();

  const { nodes: childNodes, isLoading: isChildrenLoading, error: childrenError } = useSemanticNodeList(nodeId, { retentionClass: 'persistent' });
  const { entities: nodeEntities, isLoading: isEntitiesLoading, error: entitiesError } = useSemanticEntityCollection(nodeId);
  const { entityTypes, nodeTypes } = useSemanticMetadata();
  const lock = useLock({ resourceType: 'node', resourceId: nodeId });
  const { data: currentNode, error: nodeError, isLoading: isLoadingNode } = useCacheNode(nodeId);
  const deletionFallback = currentNode?.parentId ? `/nodes/${currentNode.parentId}` : '/';
  const deletionReturnTo = useDeletionReturnContext(deletionFallback, `/nodes/${nodeId}`);
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
    setSuccessMessage(null);
    setNodeName(currentNode.name);
    setNodeDescription(currentNode.description || '');
    setDynamicNodePayload(currentNode.payload ?? {});
    setAttachmentsByField({});
    editingRowVersion.current = currentNode.rowVersion;
    setFormStale(false);
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
    editingRowVersion.current = null;
    setFormStale(false);
    await lock.releaseLock();
  };

  useEffect(() => {
    if (!lock.isMyLock || !currentNode || editingRowVersion.current === null) return;
    if (hasStaleOptimisticEdit(editingRowVersion.current, currentNode.rowVersion)) {
      setFormStale(true);
      setErrorMessage('I dati sono cambiati in un’altra sessione. Ricaricali prima di salvare.');
    }
  }, [currentNode, lock.isMyLock]);

  const reloadFresh = async () => {
    const refreshed = await AppCache.refreshNode(nodeId);
    if (!refreshed) return;
    setNodeName(refreshed.name); setNodeDescription(refreshed.description || ''); setDynamicNodePayload(refreshed.payload ?? {}); setAttachmentsByField({});
    editingRowVersion.current = refreshed.rowVersion;
    setFormStale(false);
    setErrorMessage('Dati aggiornati. Puoi continuare la modifica.');
  };

  const handleUpdateNode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentNode || !lock.isMyLock) return;
    if (formStale || hasStaleOptimisticEdit(editingRowVersion.current, currentNode.rowVersion)) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    startNodeUpdate(async () => {
      try {
        await AppCache.updateNode({
          nodeId,
          name: nodeName.trim(),
          description: nodeDescription.trim(),
          expectedRowVersion: currentNode.rowVersion,
          payloadDelta: dynamicNodePayload,
        });
        for (const field of dynamicNodeFields.filter((candidate) => ['file', 'image'].includes(candidate.dataType.toLowerCase()))) {
          for (const file of attachmentsByField[field.fieldKey] ?? []) {
            await uploadResourceAttachment({ resourceType: 'node', resourceId: nodeId, fieldKey: field.fieldKey, kind: field.dataType.toLowerCase() as 'file' | 'image', file });
          }
        }
        setAttachmentsByField({});
        await lock.releaseLock();
        setSuccessMessage('Nodo aggiornato con successo.');
      } catch (cause) {
        if (isRowVersionMismatch(cause)) {
          const refreshed = await AppCache.refreshNode(nodeId);
          if (refreshed) {
            setNodeName(refreshed.name);
            setNodeDescription(refreshed.description || '');
            setDynamicNodePayload(refreshed.payload ?? {});
            setAttachmentsByField({});
            editingRowVersion.current = refreshed.rowVersion;
            setFormStale(false);
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
    startNodeUpdate(async () => {
      try {
        await AppCache.deleteNode(nodeToDelete.id, nodeToDelete.rowVersion);
        navigationGuard.allowNavigation();
        router.push(deletionReturnTo);
      } catch (cause) {
        setErrorMessage(cause instanceof Error
          ? `Errore durante l'eliminazione del nodo: ${cause.message}`
          : 'Errore durante l’eliminazione del nodo.');
      }
    });
  };

  const displayedError = errorMessage
    ?? (childrenError ? `Errore nel caricamento del nodo: ${childrenError.message}`
      : entitiesError ? `Errore nel caricamento delle entità: ${entitiesError.message}` : null);
  const nodeErrorCode = (nodeError as (Error & { code?: string }) | null)?.code;
  const nodeAccessDenied = nodeErrorCode === 'ACCESS_FORBIDDEN'
    || nodeError?.message.includes('Non disponi dei permessi necessari')
    || nodeError?.message.includes('does not have permission');

  return {
    nodeAccess, retryNodeAccess, nodeAccessDenied, currentNode, childNodes, nodeEntities, entityTypes, nodeTypes, entityDefinitions,
    isChildrenLoading, isEntitiesLoading, isNodeLoading: isLoadingNode || !currentNode, displayedError, successMessage,
    dynamicNodeFields, dynamicNodePayload, attachmentsByField, nodeName, nodeDescription, isSavingNode, formStale, reloadFresh,
    readOnly, lockedByOther: lock.lockedByOther, isMyLock: lock.isMyLock, lockError: lock.error,
    setDynamicNodePayload, setAttachmentsByField, setNodeName, setNodeDescription,
    beginNodeEditing, exitEditMode, handleUpdateNode,
    requestDeleteNode,
  };
}
