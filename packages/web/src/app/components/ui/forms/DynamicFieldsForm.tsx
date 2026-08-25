'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { ClientEntity, EntityTypeMeta } from '../../../types/models';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { FormRenderer } from './FormRenderer';
import { createValidationMessages } from './FormDefinition';
import { useAppLocale } from '../../../i18n/AppLocaleStore';
import { buildResourceFormSchema } from './ResourceFormRenderer';

export type DynamicField = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>['fields'][number];
export interface DynamicFieldsFormProps {
  fields: readonly DynamicField[];
  payload: Record<string, unknown>;
  setPayload: Dispatch<SetStateAction<Record<string, unknown>>>;
  entityTypes?: readonly EntityTypeMeta[];
  siblingEntities?: readonly ClientEntity[];
  onCreateRelation?: (field: DynamicField) => void;
  onAddEnumOption?: (field: DynamicField) => void;
  title?: string;
  tone?: 'dark' | 'light';
}

/** Adapts persisted dynamic metadata to the shared definition-driven renderer. */
export function DynamicFieldsForm({
  fields,
  payload,
  setPayload,
  entityTypes,
  onCreateRelation,
  onAddEnumOption,
  title = 'Campi dinamici',
  tone = 'dark',
}: DynamicFieldsFormProps) {
  const { t } = useAppLocale();
  if (fields.length === 0) return null;

  const schema = buildResourceFormSchema(
    fields.filter((field) => !['file', 'image'].includes(field.dataType.toLowerCase())),
  );

  const fieldByKey = new Map(fields.map((field) => [field.fieldKey, field]));
  const setValue = (name: string, value: unknown) => {
    setPayload((current) => ({ ...current, [name]: value }));
  };

  return (
    <div className={`space-y-3 border-t pt-4 ${tone === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
      <h3 className={`text-xs font-bold uppercase tracking-wider ${tone === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
        {title}{title === 'Campi dinamici' && ` (${fields.length})`}
      </h3>
      <FormRenderer
        definition={{
          key: 'dynamic-fields',
          version: '1',
          fields: schema,
          validationMessages: createValidationMessages(t),
        }}
        values={payload}
        onChange={setValue}
        theme={tone}
        showActions={false}
        renderMode="content"
        renderFieldAddon={(schemaField): ReactNode => {
          const field = fieldByKey.get(schemaField.name);
          if (!field) return null;
          const targetType = entityTypes?.find((type) => type.typeKey === field.relationTargetTypeKey || type.id === field.relationTargetTypeKey);
          return (
            <div className="space-y-1">
              {field.enumMode === 'managed' && onAddEnumOption && (
                <button type="button" onClick={() => onAddEnumOption(field)} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                  + Aggiungi opzione
                </button>
              )}
              {schemaField.type === 'relation' && field.relationTargetDomain === 'entity' && targetType && onCreateRelation && (
                <button type="button" onClick={() => onCreateRelation(field)} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                  + Crea nuova istanza di {targetType.name}
                </button>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
