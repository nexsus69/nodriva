import { useEffect, useState, useTransition, type FormEvent } from 'react';
import type {
  ApiErrorResponse,
  CreateFieldUiCommand,
  FieldDataType,
  FieldDto,
  TypeDetailDto,
  TypeKind,
  TypeListItemDto,
  UpdateFieldUiCommand,
} from '@dashboard/core';
import { AppCache } from '../../../../../cache/GlobalCacheClient';

interface UseTypeFieldEditorOptions {
  kind: TypeKind;
  typeKey: string;
  detail: TypeDetailDto | null;
  applyDetail: (detail: TypeDetailDto) => void;
  reportConflict: (error: ApiErrorResponse) => void;
  reportSuccess: (message: string) => void;
}

export function useTypeFieldEditor({ kind, typeKey, detail, applyDetail, reportConflict, reportSuccess }: UseTypeFieldEditorOptions) {
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<FieldDto | null>(null);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [fieldKey, setFieldKey] = useState('');
  const [label, setLabel] = useState('');
  const [columnName, setColumnName] = useState('');
  const [dataType, setDataType] = useState<FieldDataType>('string');
  const [enumMode, setEnumMode] = useState<'static' | 'managed'>('static');
  const [encryptionMode, setEncryptionMode] = useState<'plaintext' | 'encrypted'>('plaintext');
  const [isRequired, setIsRequired] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [isIndexed, setIsIndexed] = useState(false);
  const [defaultValueText, setDefaultValueText] = useState('');
  const [relationTargetDomain, setRelationTargetDomain] = useState<'node' | 'entity'>('entity');
  const [relationTargetTypeKey, setRelationTargetTypeKey] = useState('');
  const [relationTargetTypes, setRelationTargetTypes] = useState<TypeListItemDto[]>([]);
  const [relationTargetTypesLoading, setRelationTargetTypesLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (dataType !== 'relation' || editingField) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setRelationTargetTypesLoading(true);
      const result = await AppCache.admin.listTypes(relationTargetDomain);
      if (!active) return;
      if (result.success && result.data) setRelationTargetTypes(result.data.filter((item) => item.isActive));
      else if (result.error) {
        setRelationTargetTypes([]);
        setFormError(result.error);
      }
      setRelationTargetTypesLoading(false);
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [dataType, editingField, relationTargetDomain]);

  const openAdd = () => {
    setEditingField(null);
    setFieldKey('');
    setLabel('');
    setColumnName('');
    setDataType('string');
    setEnumMode('static');
    setEncryptionMode('plaintext');
    setIsRequired(false);
    setIsUnique(false);
    setIsIndexed(false);
    setDefaultValueText('');
    setRelationTargetDomain('entity');
    setRelationTargetTypeKey('');
    setRelationTargetTypes([]);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (field: FieldDto) => {
    setEditingField(field);
    setFieldKey(field.fieldKey);
    setLabel(field.label);
    setColumnName(field.columnName);
    setDataType(field.dataType);
    setEnumMode(field.enumMode ?? 'static');
    setEncryptionMode(field.encryptionMode ?? 'plaintext');
    setIsRequired(field.isRequired);
    setIsUnique(field.isUnique);
    setIsIndexed(field.isIndexed);
    setDefaultValueText(field.defaultValueText ?? '');
    setRelationTargetDomain(field.relationTargetDomain ?? 'entity');
    setRelationTargetTypeKey(field.relationTargetTypeKey ?? '');
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    if (!editingField && dataType === 'relation') {
      const targetKey = relationTargetTypeKey.trim();
      if (!targetKey || !/^[a-z][a-z0-9_-]*$/.test(targetKey)) {
        setFormError({ code: 'VALIDATION_ERROR', message: 'Il type key target deve iniziare con una lettera minuscola e contenere solo lettere minuscole, numeri, underscore o trattini.', target: 'relationTargetTypeKey' });
        return;
      }
    }
    setFormError(null);
    const impact = await AppCache.admin.getTypeSchemaImpact(kind, typeKey, editingField ? 'update_field' : 'add_field', editingField?.id);
    if (!impact.success || !impact.data) {
      if (impact.error) setFormError(impact.error);
      return;
    }
    if (impact.data.blockingReasons.length > 0) {
      setFormError({ code: 'VALIDATION_ERROR', message: impact.data.blockingReasons.join(' ') });
      return;
    }
    startTransition(async () => {
      const result = editingField
        ? await AppCache.admin.updateField(kind, typeKey, {
          fieldId: editingField.id, label: label.trim(), isRequired, isUnique, isIndexed,
          defaultValueText: defaultValueText.trim() || null, encryptionMode,
          expectedTypeRowVersion: detail.rowVersion,
        } satisfies UpdateFieldUiCommand)
        : await AppCache.admin.createField(kind, typeKey, {
          fieldKey: fieldKey.trim(), label: label.trim(), columnName: columnName.trim(), dataType,
          enumMode: dataType === 'enum' ? enumMode : undefined, encryptionMode,
          isRequired, isUnique, isIndexed, defaultValueText: defaultValueText.trim() || null,
          relationTargetDomain: dataType === 'relation' ? relationTargetDomain : undefined,
          relationTargetTypeKey: dataType === 'relation' ? relationTargetTypeKey.trim() : undefined,
          position: detail.fields.length, expectedTypeRowVersion: detail.rowVersion,
        } satisfies CreateFieldUiCommand);
      if (result.success && result.data) {
        applyDetail(result.data);
        setShowModal(false);
        reportSuccess(editingField ? 'Campo aggiornato.' : 'Nuovo campo aggiunto.');
      } else if (result.error?.code === 'ROW_VERSION_MISMATCH') {
        reportConflict(result.error);
        setShowModal(false);
      } else if (result.error) setFormError(result.error);
    });
  };

  return {
    showModal, editingField, formError, isPending,
    fieldKey, label, columnName, dataType, enumMode, encryptionMode, isRequired, isUnique, isIndexed,
    defaultValueText, relationTargetDomain, relationTargetTypeKey, relationTargetTypes, relationTargetTypesLoading,
    setFieldKey, setLabel, setColumnName, setDataType, setEnumMode, setEncryptionMode,
    setIsRequired, setIsUnique, setIsIndexed, setDefaultValueText, setRelationTargetDomain, setRelationTargetTypeKey,
    openAdd, openEdit, close: () => setShowModal(false), handleSubmit,
  };
}
