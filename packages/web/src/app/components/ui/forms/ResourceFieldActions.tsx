'use client';

/** Renders the common metadata-driven actions available beside editable resource fields. */
import { useAppLocale } from '@/app/i18n/AppLocaleStore';
import type { DynamicField } from './DynamicFieldsForm';

export interface ResourceFieldActionsProps {
  field: DynamicField;
  relatedTypeName?: string;
  onAddEnumOption?: (field: DynamicField) => void;
  onCreateRelatedEntity?: (field: DynamicField) => void;
}

/** Keeps enum and related-entity actions identical wherever a resource form is editable. */
export function ResourceFieldActions({
  field,
  relatedTypeName,
  onAddEnumOption,
  onCreateRelatedEntity,
}: ResourceFieldActionsProps) {
  const { t } = useAppLocale();
  const canAddEnumOption = field.enumMode === 'managed' && onAddEnumOption;
  const canCreateRelatedEntity = field.dataType.toLowerCase() === 'relation'
    && field.relationTargetDomain === 'entity'
    && relatedTypeName
    && onCreateRelatedEntity;

  if (!canAddEnumOption && !canCreateRelatedEntity) return null;

  return (
    <div className="mt-2 space-y-1">
      {canAddEnumOption && (
        <button
          type="button"
          onClick={() => onAddEnumOption(field)}
          className="block text-xs font-semibold text-indigo-700 hover:text-indigo-900"
        >
          + {t('form.addOption')}
        </button>
      )}
      {canCreateRelatedEntity && (
        <button
          type="button"
          onClick={() => onCreateRelatedEntity(field)}
          className="block text-xs font-semibold text-indigo-700 hover:text-indigo-900"
        >
          + {t('form.createRelatedInstance').replace('{type}', relatedTypeName)}
        </button>
      )}
    </div>
  );
}
