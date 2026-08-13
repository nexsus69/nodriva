'use client';

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppCache } from '../../../../../cache/GlobalCacheClient';
import { GlobalViewStore } from '../../../../../cache/ViewStore';
import { ViewKeyBuilder } from '../../../../../cache/SemanticViewKey';
import { useLock } from '../../../../../hooks/useLock';
import { useSemanticEntityCollection } from '../../../../../hooks/useSemanticEntityCollection';
import { useSemanticEntityDetail } from '../../../../../hooks/useSemanticEntityDetail';
import { useSemanticMetadata } from '../../../../../hooks/useSemanticMetadata';
import type { DynamicField } from '../../../../../components/ui/forms';
import { uploadDynamicAttachments, validateDynamicAttachments } from '../../../../../components/ui/forms/dynamicResourceForm';

const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'numeric', 'float', 'double']);

export function useEntityDetailController(entityId: string, parentNodeId: string) {
  const router = useRouter();
  const detail = useSemanticEntityDetail(entityId, parentNodeId);
  const { entities: siblingEntities } = useSemanticEntityCollection(parentNodeId);
  const { entityTypes, entityTypesList } = useSemanticMetadata();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attachments, setAttachments] = useState<Record<string, readonly File[]>>({});
  const lock = useLock({ resourceType: 'entity', resourceId: entityId });
  const entityType = detail.entity ? entityTypes[detail.entity.entityTypeId] : undefined;

  useEffect(() => {
    if (!detail.entity || !entityType?.typeKey) return;
    const timer = window.setTimeout(() => void AppCache.admin.getTypeDefinition('entity', entityType.typeKey).then((definition) => {
      setFields(definition?.fields ?? []); setPayload(detail.entity?.payload ?? {});
    }), 0);
    return () => window.clearTimeout(timer);
  }, [detail.entity, entityType?.typeKey]);

  const beginEditing = async () => {
    if (!detail.entity) return false;
    setName(detail.entity.name || ''); setDescription(detail.entity.description || ''); setPayload(detail.entity.payload || {}); setAttachments({});
    return lock.acquireLock();
  };
  const cancelEditing = () => {
    if (!detail.entity) return;
    setName(detail.entity.name || ''); setDescription(detail.entity.description || ''); setPayload(detail.entity.payload || {}); setAttachments({}); void lock.releaseLock();
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!detail.entity) return;
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
        await AppCache.updateEntity({ entityId, name, description, payloadDelta: processed, expectedRowVersion: detail.entity!.rowVersion });
        await uploadDynamicAttachments('entity', entityId, fields, attachments);
        await lock.releaseLock(); setSuccessMessage('Entità aggiornata con successo.');
      } catch (reason) { setErrorMessage(reason instanceof Error ? reason.message : 'Errore durante l’aggiornamento dell’entità.'); }
    });
  };

  const confirmDelete = () => {
    if (!detail.entity) return;
    setDeleteOpen(false); setErrorMessage(null);
    startTransition(async () => {
      try {
        await AppCache.deleteEntity(entityId, detail.entity!.entityTypeId, detail.entity!.rowVersion);
        GlobalViewStore.delete(ViewKeyBuilder.build({ viewType: 'NODE_ENTITY_COLLECTION', baseNodeId: parentNodeId }));
        router.push(`/nodes/${parentNodeId}`);
      } catch (reason) { setErrorMessage(reason instanceof Error ? reason.message : 'Errore durante l’eliminazione.'); }
    });
  };

  return { ...detail, siblingEntities, entityTypesList, entityType, isPending, name, setName, description, setDescription, fields, payload, setPayload, errorMessage, successMessage, deleteOpen, setDeleteOpen, attachments, setAttachments, lock, beginEditing, cancelEditing, save, confirmDelete };
}
