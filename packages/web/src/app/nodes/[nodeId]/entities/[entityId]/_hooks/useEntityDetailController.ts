'use client';

/** Coordinates entity detail editing, soft deletion, locking, and safe return navigation. */
import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppCache, isRowVersionMismatch } from '../../../../../cache/GlobalCacheClient';
import { GlobalViewStore } from '../../../../../cache/ViewStore';
import { ViewKeyBuilder } from '../../../../../cache/SemanticViewKey';
import { useLock } from '../../../../../hooks/useLock';
import { useSemanticEntityCollection } from '../../../../../hooks/useSemanticEntityCollection';
import { useSemanticEntityDetail } from '../../../../../hooks/useSemanticEntityDetail';
import { useSemanticMetadata } from '../../../../../hooks/useSemanticMetadata';
import type { DynamicField } from '../../../../../components/ui/forms';
import { uploadDynamicAttachments, validateDynamicAttachments } from '../../../../../components/ui/forms/dynamicResourceForm';
import { useUnsavedChanges } from '../../../../../navigation/NavigationBlocker';
import { areFormValuesEqual, hasSelectedFiles } from '../../../../../navigation/unsavedChanges';
import { requestConfirmation } from '../../../../../components/ui/feedback/ConfirmDialogStore';
import { useDeletionReturnContext } from '../../../../../navigation/returnContext';
import { formatResourceDeleteError, getResourceDeleteRestriction, type ResourceDeleteRestriction } from '../../../../../errors/resourceDeleteError';
import {
  abandonConcurrentEdit,
  acceptConcurrentEditVersion,
  beginConcurrentEdit,
  canSubmitConcurrentEdit,
  IDLE_CONCURRENT_EDIT,
  reconcileConcurrentEdit,
} from '../../../../../editing/ConcurrentEditLifecycle';

const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'numeric', 'float', 'double']);

export interface EntityDetailNavigation {
  afterDelete: string;
  detailPath: string;
}

export function useEntityDetailController(entityId: string, parentNodeId: string, navigation?: EntityDetailNavigation) {
  const router = useRouter();
  const detail = useSemanticEntityDetail(entityId, parentNodeId);
  const { entities: siblingEntities } = useSemanticEntityCollection(parentNodeId);
  const { entityTypes, entityTypesList } = useSemanticMetadata();
  const deletionReturnTo = useDeletionReturnContext(
    navigation?.afterDelete ?? `/nodes/${parentNodeId}`,
    navigation?.detailPath ?? `/nodes/${parentNodeId}/entities/${entityId}`,
  );
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteRestriction, setDeleteRestriction] = useState<ResourceDeleteRestriction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, readonly File[]>>({});
  const [editLifecycle, setEditLifecycle] = useState(IDLE_CONCURRENT_EDIT);
  const lock = useLock({ resourceType: 'entity', resourceId: entityId });
  const reconciledEditLifecycle = reconcileConcurrentEdit(editLifecycle, {
    ownsLock: lock.isMyLock,
    currentRowVersion: detail.entity?.rowVersion,
    mutationPending: AppCache.mutations.isPending(`entity:${entityId}`),
    currentVersionIsLocal: detail.entity ? AppCache.mutations.isLocalVersion(`entity:${entityId}`, detail.entity.rowVersion) : false,
  });
  const formStale = reconciledEditLifecycle.stale;
  const entityType = detail.entity
    ? Object.values(entityTypes).find(
        (type) => type.id === detail.entity!.entityTypeId || type.typeKey === detail.entity!.entityTypeId,
      )
    : undefined;
  const hasUnsavedChanges = Boolean(lock.isMyLock && detail.entity && (
    name !== (detail.entity.name || '')
    || description !== (detail.entity.description || '')
    || !areFormValuesEqual(payload, detail.entity.payload ?? {})
    || hasSelectedFiles(attachments)
  ));
  const navigationGuard = useUnsavedChanges(hasUnsavedChanges);

  useEffect(() => {
    if (!detail.entity || !entityType?.typeKey || lock.isMyLock) return;
    const timer = window.setTimeout(() => void AppCache.admin.getTypeDefinition('entity', entityType.typeKey).then((definition) => {
      setFields(definition?.fields ?? []); setPayload(detail.entity?.payload ?? {});
    }), 0);
    return () => window.clearTimeout(timer);
  }, [detail.entity, entityType?.typeKey, lock.isMyLock]);

  const beginEditing = async () => {
    if (!detail.entity) return false;
    setName(detail.entity.name || ''); setDescription(detail.entity.description || ''); setPayload(detail.entity.payload || {}); setAttachments({});
    setEditLifecycle(beginConcurrentEdit(detail.entity.rowVersion));
    return lock.acquireLock();
  };
  const cancelEditing = async () => {
    if (!detail.entity) return;
    if (!(await navigationGuard.confirmDiscard())) return;
    setName(detail.entity.name || ''); setDescription(detail.entity.description || ''); setPayload(detail.entity.payload || {}); setAttachments({});
    setEditLifecycle(abandonConcurrentEdit());
    await lock.releaseLock();
  };

  const reloadFresh = async () => {
    const refreshed = await AppCache.refreshEntity(entityId, detail.entity?.entityTypeId ?? '');
    if (!refreshed) return;
    setName(refreshed.name); setDescription(refreshed.description || ''); setPayload(refreshed.payload || {}); setAttachments({});
    setEditLifecycle(acceptConcurrentEditVersion(refreshed.rowVersion));
    setErrorMessage('Dati aggiornati. Puoi continuare la modifica.');
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!detail.entity) return;
    if (!canSubmitConcurrentEdit(reconciledEditLifecycle, detail.entity.rowVersion)) return;
    setErrorMessage(null); setSuccessMessage(null);
    startTransition(async () => {
      try {
        const processed = { ...detail.entity!.payload, ...payload };
        for (const field of fields) {
          if (['file', 'image'].includes(field.dataType.toLowerCase())) continue;
          const value = processed[field.fieldKey];
          if (value === '' && !field.isRequired) processed[field.fieldKey] = null;
          else if (NUMBER_TYPES.has(field.dataType.toLowerCase()) && value !== '') {
            const numeric = Number(value); if (!Number.isNaN(numeric)) processed[field.fieldKey] = numeric;
          }
        }
        await validateDynamicAttachments(fields, attachments);
        const updatedEntity = await AppCache.updateEntity({ entityId, name, description, payloadDelta: processed, expectedRowVersion: detail.entity!.rowVersion });
        // The local mutation response is authoritative. Advance the editing
        // snapshot before the asynchronous lock release can trigger a render.
        setEditLifecycle(acceptConcurrentEditVersion(updatedEntity.rowVersion));
        await uploadDynamicAttachments('entity', entityId, fields, attachments);
        setAttachments({});
        await lock.releaseLock(); setSuccessMessage('Entità aggiornata con successo.');
      } catch (reason) {
        if (isRowVersionMismatch(reason) && detail.entity) {
          const refreshed = await AppCache.refreshEntity(entityId, detail.entity.entityTypeId);
          if (refreshed) {
            setName(refreshed.name);
            setDescription(refreshed.description || '');
            setPayload(refreshed.payload || {});
            setAttachments({});
            setEditLifecycle(acceptConcurrentEditVersion(refreshed.rowVersion));
            setErrorMessage('I dati sono stati aggiornati da un altro utente. I campi sono stati ricaricati; puoi continuare la modifica o uscire intenzionalmente.');
            return;
          }
        }
        setErrorMessage(reason instanceof Error ? reason.message : 'Errore durante l’aggiornamento dell’entità.');
      }
    });
  };

  const confirmDelete = () => {
    if (!detail.entity) return;
    setErrorMessage(null);
    setDeleteRestriction(null);
    startTransition(async () => {
      try {
        await AppCache.deleteEntity(entityId, detail.entity!.entityTypeId, detail.entity!.rowVersion);
        GlobalViewStore.delete(ViewKeyBuilder.build({ viewType: 'NODE_ENTITY_COLLECTION', baseNodeId: parentNodeId }));
        navigationGuard.allowNavigation();
        router.push(deletionReturnTo);
      } catch (reason) {
        setErrorMessage(reason instanceof Error
          ? formatResourceDeleteError(reason as Error & { code?: unknown; totalReferencerCount?: unknown; referencers?: unknown })
          : 'Errore durante l’eliminazione.');
        setDeleteRestriction(reason instanceof Error ? getResourceDeleteRestriction(reason as Error & { code?: unknown; totalReferencerCount?: unknown; referencers?: unknown }) : null);
      }
    });
  };

  const requestDelete = async () => {
    const confirmed = await requestConfirmation({
      title: 'Elimina entità?',
      description: 'L’entità verrà spostata nel cestino.',
      confirmLabel: 'Elimina',
      cancelLabel: 'Annulla',
      tone: 'danger',
    });
    if (!confirmed) return;
    if (!lock.isMyLock && !(await beginEditing())) return;
    confirmDelete();
  };

  return { ...detail, siblingEntities, entityTypesList, entityType, isPending, name, setName, description, setDescription, fields, payload, setPayload, errorMessage: formStale ? 'I dati sono cambiati in un’altra sessione. Ricaricali prima di salvare.' : errorMessage, deleteRestriction, successMessage, attachments, setAttachments, formStale, reloadFresh, lock, beginEditing, cancelEditing, save, confirmDelete, requestDelete };
}
