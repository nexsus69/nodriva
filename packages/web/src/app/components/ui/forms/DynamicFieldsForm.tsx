'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { ClientEntity, EntityTypeMeta } from '../../../types/models';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { FormRenderer, type FormFieldSchema } from './FormRenderer';
import { createValidationMessages } from './FormDefinition';
import { useAppLocale } from '../../../i18n/AppLocaleStore';

export type DynamicField = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>['fields'][number];
type EnumOption = { value: string; label: string; isActive: boolean };

function getEnumOptions(field: DynamicField): readonly EnumOption[] {
  if (field.enumOptions && field.enumOptions.length > 0) return field.enumOptions;
  const legacy = field.constraints.find((constraint) => constraint.constraintType === 'enum');
  return legacy
    ? legacy.constraintValueText.split(',').map((value) => value.trim()).filter(Boolean).map((value) => ({ value, label: value, isActive: true }))
    : [];
}

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

  const schema: FormFieldSchema[] = fields
    .filter((field) => field.dataType.toLowerCase() !== 'file' && field.dataType.toLowerCase() !== 'image')
    .map((field) => {
      const dataType = field.dataType.toLowerCase();
      const base = {
        name: field.fieldKey,
        label: field.label ?? field.fieldKey,
        required: field.isRequired,
      };
      if (dataType === 'boolean') return { ...base, type: 'boolean' as const };
      if (dataType === 'enum') {
        return {
          ...base,
          type: 'select' as const,
          options: getEnumOptions(field).filter((option) => option.isActive),
        };
      }
      if (dataType === 'relation' && field.relationTargetDomain && field.relationTargetTypeKey) {
        return {
          ...base,
          type: 'relation' as const,
          resourceType: field.relationTargetDomain,
          typeKey: field.relationTargetTypeKey,
        };
      }
      if (dataType === 'json' || dataType === 'array') return { ...base, type: 'textarea' as const, rows: 4 };
      if (dataType === 'date' || dataType === 'datetime' || dataType === 'timestamp') {
        return { ...base, type: dataType === 'date' ? 'date' as const : 'datetime-local' as const };
      }
      if (['number', 'integer', 'decimal', 'numeric', 'float', 'double'].includes(dataType)) {
        return { ...base, type: 'number' as const, step: dataType === 'integer' ? 1 : 'any' as never };
      }
      return { ...base, type: 'text' as const };
    });

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
        onSubmit={(event) => event.preventDefault()}
        theme={tone}
        showActions={false}
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
