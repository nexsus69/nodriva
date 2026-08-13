'use client';

import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { AppCache } from '../../../../../cache/GlobalCacheClient';
import type { DynamicField } from '../../../../../components/ui/forms';
import { coerceDynamicPayload, initializeDynamicPayload } from '../../../../../components/ui/forms/dynamicResourceForm';

export function useRelatedEntityCreation(parentNodeId: string, setMainPayload: Dispatch<SetStateAction<Record<string, unknown>>>, setError: (message: string | null) => void) {
  const [field, setField] = useState<DynamicField | null>(null);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!field?.relationTargetTypeKey || field.relationTargetDomain !== 'entity') return;
    const timer = window.setTimeout(() => void AppCache.admin.getTypeDefinition('entity', field.relationTargetTypeKey!).then((definition) => {
      const nextFields = definition?.fields ?? [];
      setFields(nextFields); setPayload(initializeDynamicPayload(nextFields));
    }), 0);
    return () => window.clearTimeout(timer);
  }, [field]);

  const open = (nextField: DynamicField) => { setField(nextField); setFields([]); setPayload({}); setName(''); setDescription(''); setError(null); };
  const close = () => setField(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!field?.relationTargetTypeKey) return;
    setError(null); setPending(true);
    void AppCache.createEntity({ parentNodeId, entityTypeKey: field.relationTargetTypeKey, name: name.trim(), description: description.trim(), payload: coerceDynamicPayload(fields, payload) })
      .then((created) => { setMainPayload((current) => ({ ...current, [field.fieldKey]: created.id })); setField(null); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Impossibile creare l’istanza collegata.'))
      .finally(() => setPending(false));
  };

  return { field, fields, payload, setPayload, name, setName, description, setDescription, pending, open, close, submit };
}
