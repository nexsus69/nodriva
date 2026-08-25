'use client';

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { GlobalViewStore } from '../../../../cache/ViewStore';
import { ViewKeyBuilder } from '../../../../cache/SemanticViewKey';
import { useLock } from '../../../../hooks/useLock';
import { useSemanticMetadata } from '../../../../hooks/useSemanticMetadata';
import type { DynamicField } from '../../../../components/ui/forms';
import { coerceDynamicPayload, initializeDynamicPayload, uploadDynamicAttachments, validateDynamicAttachments } from '../../../../components/ui/forms/dynamicResourceForm';
import { useUnsavedChanges } from '../../../../navigation/NavigationBlocker';
import { areFormValuesEqual, hasSelectedFiles } from '../../../../navigation/unsavedChanges';

export function useCreateChildNode(parentNodeId: string) {
  const router = useRouter();
  const { nodeTypesList } = useSemanticMetadata();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [typeKey, setTypeKey] = useState('');
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [enumField, setEnumField] = useState<DynamicField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, readonly File[]>>({});
  const createdId = useRef<string | null>(null);
  const [initialPayload, setInitialPayload] = useState<Record<string, unknown>>({});
  const [hasCreatedResource, setHasCreatedResource] = useState(false);
  const submitting = useRef(false);
  const lock = useLock({ resourceType: 'node', resourceId: parentNodeId });
  const { acquireLock } = lock;
  const navigationGuard = useUnsavedChanges(
    name !== '' || description !== '' || !areFormValuesEqual(payload, initialPayload)
      || hasSelectedFiles(attachments) || hasCreatedResource,
  );

  useEffect(() => { const timer = window.setTimeout(() => void acquireLock(), 0); return () => window.clearTimeout(timer); }, [acquireLock]);
  useEffect(() => {
    const selectedType = typeKey || nodeTypesList[0]?.typeKey;
    if (!selectedType) return;
    const timer = window.setTimeout(() => {
      if (!typeKey) setTypeKey(selectedType);
      void AppCache.admin.getTypeDefinition('node', selectedType).then((definition) => {
        const nextFields = definition?.fields ?? [];
        const nextPayload = initializeDynamicPayload(nextFields);
        setInitialPayload(nextPayload);
        setFields(nextFields); setPayload(nextPayload); setAttachments({});
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [nodeTypesList, typeKey]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setError(null);
    startTransition(async () => {
      try {
        await validateDynamicAttachments(fields, attachments);
        const resourceId = createdId.current ?? (await AppCache.createNode({ parentNodeId, nodeTypeKey: typeKey, name, description, payload: coerceDynamicPayload(fields, payload) })).id;
        createdId.current = resourceId;
        setHasCreatedResource(true);
        await uploadDynamicAttachments('node', resourceId, fields, attachments);
        GlobalViewStore.delete(ViewKeyBuilder.build({ viewType: 'SUBTREE_LIST', baseNodeId: parentNodeId }));
        navigationGuard.allowNavigation();
        router.push(`/nodes/${parentNodeId}`);
      } catch (reason) {
        submitting.current = false;
        setError(reason instanceof Error ? reason.message : 'Errore nella creazione del nodo.');
      }
    });
  };

  const addEnumOption = (option: NonNullable<DynamicField['enumOptions']>[number]) => {
    if (!enumField) return;
    setFields((current) => current.map((field) => field.id === enumField.id ? { ...field, enumOptions: [...(field.enumOptions ?? []), option] } : field));
  };

  const cancel = async () => {
    if (!(await navigationGuard.confirmDiscard())) return;
    navigationGuard.allowNavigation();
    router.push(`/nodes/${parentNodeId}`);
  };

  return { nodeTypesList, isPending, name, setName, description, setDescription, typeKey, setTypeKey, fields, setFields, payload, setPayload, enumField, setEnumField, error, setError, attachments, setAttachments, lock, submit, addEnumOption, cancel };
}
