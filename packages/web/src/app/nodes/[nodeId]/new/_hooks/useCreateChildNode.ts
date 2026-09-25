'use client';

/** Owns a child-node creation draft without acquiring a lock on its containing node. */
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { GlobalViewStore } from '../../../../cache/ViewStore';
import { ViewKeyBuilder } from '../../../../cache/SemanticViewKey';
import { useSemanticMetadata } from '../../../../hooks/useSemanticMetadata';
import type { DynamicField } from '../../../../components/ui/forms';
import { coerceDynamicPayload, initializeDynamicPayload, uploadDynamicAttachments, validateDynamicAttachments } from '../../../../components/ui/forms/dynamicResourceForm';
import { useUnsavedChanges } from '../../../../navigation/NavigationBlocker';
import { areFormValuesEqual, hasSelectedFiles } from '../../../../navigation/unsavedChanges';
import { useReturnContext } from '../../../../navigation/returnContext';
import { useUserMutation } from '../../../../mutations/useUserMutation';

export function useCreateChildNode(parentNodeId: string) {
  const router = useRouter();
  const returnTo = useReturnContext(`/nodes/${parentNodeId}`);
  const { nodeTypesList } = useSemanticMetadata();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [typeKey, setTypeKey] = useState('');
  const selectedTypeKey = typeKey || nodeTypesList[0]?.typeKey || '';
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [enumField, setEnumField] = useState<DynamicField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useUserMutation();
  const [attachments, setAttachments] = useState<Record<string, readonly File[]>>({});
  const createdId = useRef<string | null>(null);
  const [initialPayload, setInitialPayload] = useState<Record<string, unknown>>({});
  const [hasCreatedResource, setHasCreatedResource] = useState(false);
  const submitting = useRef(false);
  const navigationGuard = useUnsavedChanges(
    name !== '' || description !== '' || !areFormValuesEqual(payload, initialPayload)
      || hasSelectedFiles(attachments) || hasCreatedResource,
  );

  useEffect(() => {
    if (!selectedTypeKey) return;
    const timer = window.setTimeout(() => void AppCache.admin.getTypeDefinition('node', selectedTypeKey).then((definition) => {
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
      const result = await mutation.execute(async () => {
        await validateDynamicAttachments(fields, attachments);
        const resourceId = createdId.current ?? (await AppCache.createNode({ parentNodeId, nodeTypeKey: selectedTypeKey, name, description, payload: coerceDynamicPayload(fields, payload) })).id;
        createdId.current = resourceId;
        setHasCreatedResource(true);
        await uploadDynamicAttachments('node', resourceId, fields, attachments);
        GlobalViewStore.delete(ViewKeyBuilder.build({ viewType: 'SUBTREE_LIST', baseNodeId: parentNodeId }));
        navigationGuard.allowNavigation();
        router.push(returnTo);
      });
      if (!result.ok) {
        submitting.current = false;
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
    router.push(returnTo);
  };

  return { nodeTypesList, isPending: isPending || mutation.pending, name, setName, description, setDescription, typeKey: selectedTypeKey, setTypeKey, fields, setFields, payload, setPayload, enumField, setEnumField, error: error ?? mutation.failure?.message ?? null, setError, mutationFailure: mutation.failure, retryMutation: () => void mutation.retry(), attachments, setAttachments, returnTo, submit, addEnumOption, cancel };
}
