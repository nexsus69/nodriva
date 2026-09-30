'use client';

/** Owns an entity-creation draft without acquiring a lock on its containing node. */
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AppCache } from '../../../../../cache/GlobalCacheClient';
import { useSemanticEntityCollection } from '../../../../../hooks/useSemanticEntityCollection';
import { useSemanticMetadata } from '../../../../../hooks/useSemanticMetadata';
import { useRelatedEntityCreation, type DynamicField } from '../../../../../components/ui/forms';
import { coerceDynamicPayload, initializeDynamicPayload, uploadDynamicAttachments, validateDynamicAttachments } from '../../../../../components/ui/forms/dynamicResourceForm';
import { useUnsavedChanges } from '../../../../../navigation/NavigationBlocker';
import { areFormValuesEqual, hasSelectedFiles } from '../../../../../navigation/unsavedChanges';
import { useReturnContext } from '../../../../../navigation/returnContext';
import { useUserMutation } from '../../../../../mutations/useUserMutation';
import { useManagedEnumOptionForm } from '../../../../../components/ui/forms/useManagedEnumOptionForm';

export function useCreateEntity(parentNodeId: string) {
  const router = useRouter();
  const returnTo = useReturnContext(`/nodes/${parentNodeId}`);
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
  const mutation = useUserMutation();
  const [attachments, setAttachments] = useState<Record<string, readonly File[]>>({});
  const createdId = useRef<string | null>(null);
  const attachmentVersion = useRef(1);
  const uploadedFiles = useRef(new Set<File>());
  const [initialPayload, setInitialPayload] = useState<Record<string, unknown>>({});
  const [hasCreatedResource, setHasCreatedResource] = useState(false);
  const submitting = useRef(false);
  const related = useRelatedEntityCreation(parentNodeId, setPayload);
  const addEnumOption = useCallback((field: DynamicField, option: NonNullable<DynamicField['enumOptions']>[number]) => {
    setFields((current) => current.map((candidate) => candidate.id === field.id ? {
      ...candidate,
      enumOptions: [...(candidate.enumOptions ?? []), option],
    } : candidate));
  }, []);
  const enumOption = useManagedEnumOptionForm<DynamicField>({
    kind: 'entity',
    typeKey: selectedTypeKey,
    onOptionAdded: addEnumOption,
  });
  const navigationGuard = useUnsavedChanges(
    name !== '' || description !== '' || !areFormValuesEqual(payload, initialPayload)
      || hasSelectedFiles(attachments) || hasCreatedResource || enumOption.isDirty || related.isDirty,
  );

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
      const result = await mutation.execute(async () => {
        await validateDynamicAttachments(fields, attachments);
        const resourceId = createdId.current ?? (await AppCache.createEntity({ parentNodeId, entityTypeKey: selectedTypeKey, name, description, payload: coerceDynamicPayload(fields, payload) })).id;
        createdId.current = resourceId;
        setHasCreatedResource(true);
        await uploadDynamicAttachments('entity', resourceId, fields, attachments, { expectedRowVersion: attachmentVersion.current, acquireLock: true, completedFiles: uploadedFiles.current, onUploaded: (version) => { attachmentVersion.current = version; } });
        navigationGuard.allowNavigation();
        router.push(returnTo);
      }, undefined, { successKey: 'mutation.entityCreated' });
      if (!result.ok) {
        submitting.current = false;
      }
    });
  };

  const cancel = async () => {
    if (!(await navigationGuard.confirmDiscard())) return;
    navigationGuard.allowNavigation();
    router.push(returnTo);
  };

  return { entityTypesList, siblingEntities, isPending: isPending || mutation.pending, name, setName, description, setDescription, typeKey: selectedTypeKey, setTypeKey, fields, payload, setPayload, error: error ?? mutation.failure?.message ?? null, setError, mutationFailure: mutation.failure, retryMutation: () => void mutation.retry(), attachments, setAttachments, enumOption, related, returnTo, submit, cancel };
}
