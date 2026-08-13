import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { useSemanticNodeList } from '../../../hooks/useSemanticNodeList';
import { useSemanticEntityCollection } from '../../../hooks/useSemanticEntityCollection';
import { useSemanticMetadata } from '../../../hooks/useSemanticMetadata';
import { useCacheNode } from '../../../hooks/useCacheNode';
import { useLock } from '../../../hooks/useLock';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { uploadResourceAttachment } from '../../../attachments/attachmentClient';
import { checkNodeReadAccessAction } from '../../../actions/nodeActions';

export type DynamicNodeField = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>['fields'][number];
export type EntityTypeDefinition = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>;

export function useNodeDetail(nodeId: string) {
  const [nodeAccess, setNodeAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeDescription, setNodeDescription] = useState('');
  const [dynamicNodeFields, setDynamicNodeFields] = useState<DynamicNodeField[]>([]);
  const [dynamicNodePayload, setDynamicNodePayload] = useState<Record<string, unknown>>({});
  const [attachmentsByField, setAttachmentsByField] = useState<Record<string, readonly File[]>>({});
  const [entityDefinitions, setEntityDefinitions] = useState<Record<string, EntityTypeDefinition>>({});
  const [isSavingNode, startNodeUpdate] = useTransition();

  const { nodes: childNodes, error: childrenError } = useSemanticNodeList(nodeId, { retentionClass: 'persistent' });
  const { entities: nodeEntities, isLoading: isEntitiesLoading, error: entitiesError } = useSemanticEntityCollection(nodeId);
  const { entityTypes, nodeTypes } = useSemanticMetadata();
  const lock = useLock({ resourceType: 'node', resourceId: nodeId });
  const { data: currentNode, error: nodeError, isLoading: isLoadingNode } = useCacheNode(nodeId);
  const readOnly = !lock.isMyLock;

  useEffect(() => {
    let cancelled = false;
    void checkNodeReadAccessAction(nodeId)
      .then((allowed) => { if (!cancelled) setNodeAccess(allowed ? 'allowed' : 'denied'); })
      .catch(() => { if (!cancelled) setNodeAccess('denied'); });
    return () => { cancelled = true; };
  }, [nodeId]);

  useEffect(() => {
    const nodeTypeKey = currentNode ? nodeTypes[currentNode.nodeTypeId]?.typeKey : undefined;
    if (!currentNode || !nodeTypeKey) return;
    const timer = window.setTimeout(() => {
      AppCache.admin.getTypeDefinition('node', nodeTypeKey).then((definition) => {
        setDynamicNodeFields(definition?.fields ?? []);
        setDynamicNodePayload(currentNode.payload ?? {});
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentNode, nodeTypes]);

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
    setAttachmentsByField({});
    return lock.acquireLock();
  };

  const exitEditMode = async () => {
    if (currentNode) {
      setNodeName(currentNode.name);
      setNodeDescription(currentNode.description || '');
    }
    await lock.releaseLock();
  };

  const handleUpdateNode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentNode || !lock.isMyLock) return;
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
        await lock.releaseLock();
        setSuccessMessage('Nodo aggiornato con successo.');
      } catch (cause) {
        setErrorMessage(cause instanceof Error ? `Errore durante l'aggiornamento del nodo: ${cause.message}` : `Errore durante l'aggiornamento del nodo.`);
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
    nodeAccess, nodeAccessDenied, currentNode, childNodes, nodeEntities, entityTypes, entityDefinitions,
    isEntitiesLoading, isNodeLoading: isLoadingNode || !currentNode, displayedError, successMessage,
    dynamicNodeFields, dynamicNodePayload, attachmentsByField, nodeName, nodeDescription, isSavingNode,
    readOnly, lockedByOther: lock.lockedByOther, isMyLock: lock.isMyLock, lockError: lock.error,
    setDynamicNodePayload, setAttachmentsByField, setNodeName, setNodeDescription,
    beginNodeEditing, exitEditMode, handleUpdateNode,
  };
}
