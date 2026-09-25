'use client';

/** Coordinates creation of a related entity from within an entity-creation draft. */
import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { AppCache } from '../../../../../cache/GlobalCacheClient';
import type { DynamicField } from '../../../../../components/ui/forms';
import { coerceDynamicPayload, initializeDynamicPayload } from '../../../../../components/ui/forms/dynamicResourceForm';
import { useUserMutation } from '../../../../../mutations/useUserMutation';

export function useRelatedEntityCreation(parentNodeId: string, setMainPayload: Dispatch<SetStateAction<Record<string, unknown>>>) {
  const [field, setField] = useState<DynamicField | null>(null);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const mutation = useUserMutation();

  useEffect(() => {
    if (!field?.relationTargetTypeKey || field.relationTargetDomain !== 'entity') return;
    const timer = window.setTimeout(() => void AppCache.admin.getTypeDefinition('entity', field.relationTargetTypeKey!).then((definition) => {
      const nextFields = definition?.fields ?? [];
      setFields(nextFields); setPayload(initializeDynamicPayload(nextFields));
    }), 0);
    return () => window.clearTimeout(timer);
  }, [field]);

  const open = (nextField: DynamicField) => { setField(nextField); setFields([]); setPayload({}); setName(''); setDescription(''); mutation.clear(); };
  const close = () => setField(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!field?.relationTargetTypeKey) return;
    void mutation.execute(async () => {
      const created = await AppCache.createEntity({ parentNodeId, entityTypeKey: field.relationTargetTypeKey ?? undefined, name: name.trim(), description: description.trim() || undefined, payload: coerceDynamicPayload(fields, payload) });
      setMainPayload((current) => ({ ...current, [field.fieldKey]: created.id })); setField(null);
    });
  };

  return { field, fields, payload, setPayload, name, setName, description, setDescription, pending: mutation.pending, failure: mutation.failure, retry: () => void mutation.retry(), open, close, submit };
}
