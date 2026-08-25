'use client';

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppCache } from '../../../../../cache/GlobalCacheClient';
import { GlobalViewStore } from '../../../../../cache/ViewStore';
import { ViewKeyBuilder } from '../../../../../cache/SemanticViewKey';
import { useLock } from '../../../../../hooks/useLock';
import { useSemanticEntityCollection } from '../../../../../hooks/useSemanticEntityCollection';
import { useSemanticMetadata } from '../../../../../hooks/useSemanticMetadata';
import type { DynamicField } from '../../../../../components/ui/forms';
import { coerceDynamicPayload, initializeDynamicPayload, uploadDynamicAttachments, validateDynamicAttachments } from '../../../../../components/ui/forms/dynamicResourceForm';
import { useRelatedEntityCreation } from './useRelatedEntityCreation';
import { useUnsavedChanges } from '../../../../../navigation/NavigationBlocker';
import { areFormValuesEqual, hasSelectedFiles } from '../../../../../navigation/unsavedChanges';

export function useCreateEntity(parentNodeId: string) {
  const router = useRouter();
  const { entityTypesList } = useSemanticMetadata();
  const { entities: siblingEntities } = useSemanticEntityCollection(parentNodeId);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [typeKey, setTypeKey] = useState('');
  const selectedTypeKey = typeKey || entityTypesList[0]?.typeKey || '';
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, readonly File[]>>({});
  const [enumField, setEnumField] = useState<DynamicField | null>(null);
  const createdId = useRef<string | null>(null);
  const [initialPayload, setInitialPayload] = useState<Record<string, unknown>>({});
  const [hasCreatedResource, setHasCreatedResource] = useState(false);
  const submitting = useRef(false);
  const lock = useLock({ resourceType: 'node', resourceId: parentNodeId });
  const { acquireLock } = lock;
  const related = useRelatedEntityCreation(parentNodeId, setPayload, setError);
  const navigationGuard = useUnsavedChanges(
    name !== '' || description !== '' || !areFormValuesEqual(payload, initialPayload)
      || hasSelectedFiles(attachments) || hasCreatedResource,
  );

  useEffect(() => { const timer = window.setTimeout(() => void acquireLock(), 0); return () => window.clearTimeout(timer); }, [acquireLock]);
  useEffect(() => {
    if (!selectedTypeKey) return;
    const timer = window.setTimeout(() => void AppCache.admin.getTypeDefinition('entity', selectedTypeKey).then((definition) => {
      const nextFields = definition?.fields ?? [];
      const nextPayload = initializeDynamicPayload(nextFields);
      setInitialPayload(nextPayload);
      setFields(nextFields); setPayload(nextPayload); setAttachments({});
    }), 0);
    return () => window.clearTimeout(timer);
  }, [selectedTypeKey]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setError(null);
    startTransition(async () => {
      try {
        await validateDynamicAttachments(fields, attachments);
        const resourceId = createdId.current ?? (await AppCache.createEntity({ parentNodeId, entityTypeKey: selectedTypeKey, name, description, payload: coerceDynamicPayload(fields, payload) })).id;
        createdId.current = resourceId;
        setHasCreatedResource(true);
        await uploadDynamicAttachments('entity', resourceId, fields, attachments);
        GlobalViewStore.delete(ViewKeyBuilder.build({ viewType: 'NODE_ENTITY_COLLECTION', baseNodeId: parentNodeId }));
        navigationGuard.allowNavigation();
        router.push(`/nodes/${parentNodeId}`);
      } catch (reason) {
        submitting.current = false;
        setError(reason instanceof Error ? reason.message : 'Errore nella creazione dell’entità.');
      }
    });
  };

  const addEnumOption = (option: NonNullable<DynamicField['enumOptions']>[number]) => {
    if (enumField) setFields((current) => current.map((field) => field.id === enumField.id ? { ...field, enumOptions: [...(field.enumOptions ?? []), option] } : field));
  };

  const cancel = async () => {
    if (!(await navigationGuard.confirmDiscard())) return;
    navigationGuard.allowNavigation();
    router.push(`/nodes/${parentNodeId}`);
  };

  return { entityTypesList, siblingEntities, isPending, name, setName, description, setDescription, typeKey: selectedTypeKey, setTypeKey, fields, payload, setPayload, error, setError, attachments, setAttachments, enumField, setEnumField, lock, related, submit, addEnumOption, cancel };
}
