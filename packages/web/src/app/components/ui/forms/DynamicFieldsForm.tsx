import type { Dispatch, SetStateAction } from 'react';
import type { ClientEntity, EntityTypeMeta } from '../../../types/models';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { RelationPicker } from './RelationPicker';

export type DynamicField = NonNullable<Awaited<ReturnType<typeof AppCache.admin.getTypeDefinition>>>['fields'][number];
type EnumOption = { value: string; label: string; isActive: boolean };

const NUMBER_TYPES = new Set(['number', 'integer', 'decimal', 'numeric', 'float', 'double']);

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
  if (fields.length === 0) return null;

  const updateValue = (fieldKey: string, value: unknown) => {
    setPayload((current) => ({ ...current, [fieldKey]: value }));
  };

  return (
    <div className={`space-y-3 border-t pt-4 ${tone === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
      <h3 className={`text-xs font-bold uppercase tracking-wider ${tone === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{title}{title === 'Campi dinamici' && ` (${fields.length})`}</h3>
      {fields.map((field) => {
        const dataType = field.dataType.toLowerCase();
        if (dataType === 'file' || dataType === 'image') return null;
        const targetType = entityTypes?.find((type) => type.typeKey === field.relationTargetTypeKey || type.id === field.relationTargetTypeKey);

        if (dataType === 'boolean') {
          return (
            <label key={field.fieldKey} className={`flex items-center gap-2 text-xs ${tone === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
              <input type="checkbox" checked={Boolean(payload[field.fieldKey])} onChange={(event) => updateValue(field.fieldKey, event.target.checked)} className={`rounded text-indigo-600 ${tone === 'light' ? 'border-slate-300 bg-white' : 'border-slate-800 bg-slate-900'}`} />
              {field.label ?? field.fieldKey} {field.isRequired ? '*' : ''}
            </label>
          );
        }

        return (
          <div key={field.fieldKey}>
            <label className={`mb-1 block text-xs font-medium ${tone === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{field.label ?? field.fieldKey} {field.isRequired ? '*' : ''}</label>
            {dataType === 'enum' ? (
              <>
                <select required={field.isRequired} value={String(payload[field.fieldKey] ?? '')} onChange={(event) => updateValue(field.fieldKey, event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-xs ${tone === 'light' ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-slate-800 bg-slate-900 text-slate-100'}`}>
                  <option value="">Seleziona un valore</option>
                  {getEnumOptions(field).filter((option) => option.isActive).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {field.enumMode === 'managed' && onAddEnumOption && <button type="button" onClick={() => onAddEnumOption(field)} className="mt-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300">+ Aggiungi opzione</button>}
              </>
            ) : dataType === 'relation' && field.relationTargetDomain && field.relationTargetTypeKey ? (
              <>
                <RelationPicker fieldKey={field.fieldKey} label={field.label ?? field.fieldKey} value={payload[field.fieldKey]} required={field.isRequired} resourceType={field.relationTargetDomain} typeKey={field.relationTargetTypeKey} tone={tone} onChange={(value) => updateValue(field.fieldKey, value)} />
                {field.relationTargetDomain === 'entity' && targetType && onCreateRelation && <button type="button" onClick={() => onCreateRelation(field)} className="mt-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300">+ Crea nuova istanza di {targetType.name}</button>}
              </>
            ) : (
              <input required={field.isRequired} type={NUMBER_TYPES.has(dataType) ? 'number' : ['date', 'datetime', 'timestamp'].includes(dataType) ? 'date' : 'text'} step={dataType !== 'integer' ? 'any' : undefined} value={String(payload[field.fieldKey] ?? '')} onChange={(event) => updateValue(field.fieldKey, event.target.value)} className={`w-full rounded-lg border px-3 py-2 font-mono text-xs ${tone === 'light' ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-slate-800 bg-slate-900 text-slate-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
