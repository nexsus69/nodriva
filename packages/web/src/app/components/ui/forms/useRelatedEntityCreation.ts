'use client';

/** Owns one related-entity draft for an editable resource payload. */
import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { coerceDynamicPayload, initializeDynamicPayload } from './dynamicResourceForm';
import type { DynamicField } from './DynamicFieldsForm';
import { useUserMutation } from '../../../mutations/useUserMutation';
import { areFormValuesEqual } from '../../../navigation/unsavedChanges';

/** Coordinates creation and selection of a relation target without duplicate modal state. */
export function useRelatedEntityCreation(
  parentNodeId: string,
  setMainPayload: Dispatch<SetStateAction<Record<string, unknown>>>,
) {
  const [field, setField] = useState<DynamicField | null>(null);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [initialPayload, setInitialPayload] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const mutation = useUserMutation();

  useEffect(() => {
    if (!field?.relationTargetTypeKey || field.relationTargetDomain !== 'entity') return;
    const timer = window.setTimeout(() => void AppCache.admin.getTypeDefinition('entity', field.relationTargetTypeKey!).then((definition) => {
      const nextFields = definition?.fields ?? [];
      const nextPayload = initializeDynamicPayload(nextFields);
      setFields(nextFields);
      setInitialPayload(nextPayload);
      setPayload(nextPayload);
    }), 0);
    return () => window.clearTimeout(timer);
  }, [field]);

  const open = (nextField: DynamicField) => {
    setField(nextField);
    setFields([]);
    setInitialPayload({});
    setPayload({});
    setName('');
    setDescription('');
    mutation.clear();
  };
  const close = () => setField(null);
  const discard = () => {
    setPayload(initialPayload);
    setName('');
    setDescription('');
    mutation.clear();
  };
  const reset = () => {
    setField(null);
    setFields([]);
    setInitialPayload({});
    setPayload({});
    setName('');
    setDescription('');
    mutation.clear();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!field?.relationTargetTypeKey) return;
    void mutation.execute(async () => {
      const created = await AppCache.createEntity({
        parentNodeId,
        entityTypeKey: field.relationTargetTypeKey ?? undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        payload: coerceDynamicPayload(fields, payload),
      });
      setMainPayload((current) => ({ ...current, [field.fieldKey]: created.id }));
      setField(null);
    }, undefined, { successKey: 'mutation.relatedEntityCreated' });
  };

  const isDirty = field !== null && (
    name !== '' || description !== '' || !areFormValuesEqual(payload, initialPayload)
  );

  return {
    field, fields, payload, setPayload, name, setName, description, setDescription,
    isDirty, pending: mutation.pending, failure: mutation.failure,
    retry: () => void mutation.retry(), open, close, discard, reset, submit,
  };
}
