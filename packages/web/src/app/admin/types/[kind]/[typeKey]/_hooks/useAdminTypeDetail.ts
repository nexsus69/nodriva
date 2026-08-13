import { useCallback, useEffect, useState, useSyncExternalStore, useTransition, type FormEvent } from 'react';
import type {
  ApiErrorResponse,
  AuditLogListItemDto,
  DeleteFieldUiCommand,
  DisableTypeUiCommand,
  PaginatedResultDto,
  ReorderFieldsUiCommand,
  TypeDetailDto,
  TypeKind,
  TypeSchemaRollbackPlanDto,
  UpdateTypeUiCommand,
} from '@dashboard/core';
import { AppCache } from '../../../../../cache/GlobalCacheClient';
import { useTypeFieldEditor } from './useTypeFieldEditor';

type SchemaImpact = Awaited<ReturnType<typeof AppCache.admin.getTypeSchemaImpact>>['data'];

export function useAdminTypeDetail(kind: TypeKind, typeKey: string) {
  const [typeDetail, setTypeDetail] = useState<TypeDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [conflictError, setConflictError] = useState<ApiErrorResponse | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<{ id: string; label: string } | null>(null);
  const [confirmationImpact, setConfirmationImpact] = useState('');
  const [rollbackPlan, setRollbackPlan] = useState<TypeSchemaRollbackPlanDto | null>(null);
  const [schemaHistory, setSchemaHistory] = useState<PaginatedResultDto<AuditLogListItemDto> | null>(null);
  const [schemaImpact, setSchemaImpact] = useState<SchemaImpact>(undefined);
  const [isTypePending, startTransition] = useTransition();
  const cacheRevision = useSyncExternalStore(AppCache.subscribe, AppCache.getRevision, () => 0);

  const applyTypeDetail = (detail: TypeDetailDto) => {
    setTypeDetail(detail);
    setTypeName(detail.name);
    setTypeDescription(detail.description);
  };

  const fieldEditor = useTypeFieldEditor({
    kind,
    typeKey,
    detail: typeDetail,
    applyDetail: applyTypeDetail,
    reportConflict: setConflictError,
    reportSuccess: setSuccessMessage,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConflictError(null);
    const result = await AppCache.admin.getTypeDetail(kind, typeKey);
    if (result.success && result.data) applyTypeDetail(result.data);
    else if (result.error) setError(result.error);
    setLoading(false);
  }, [kind, typeKey]);

  useEffect(() => {
    if (!kind || !typeKey) return;
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [cacheRevision, kind, loadData, typeKey]);

  useEffect(() => {
    if (!typeDetail) return;
    let active = true;
    Promise.all([
      AppCache.admin.listTypeSchemaHistory(kind, typeDetail.id),
      AppCache.admin.getTypeSchemaImpact(kind, typeDetail.typeKey),
    ]).then(([history, impact]) => {
      if (!active) return;
      if (history.success && history.data) setSchemaHistory(history.data);
      if (impact.success) setSchemaImpact(impact.data);
    });
    return () => { active = false; };
  }, [cacheRevision, kind, typeDetail]);

  const setMutationError = (mutationError: ApiErrorResponse) => {
    if (mutationError.code === 'ROW_VERSION_MISMATCH') setConflictError(mutationError);
    else setError(mutationError);
  };

  const handleUpdateType = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!typeDetail) return;
    setError(null);
    setConflictError(null);
    setSuccessMessage(null);
    const command: UpdateTypeUiCommand = {
      name: typeName.trim(),
      description: typeDescription.trim(),
      expectedRowVersion: typeDetail.rowVersion,
    };
    startTransition(async () => {
      const result = await AppCache.admin.updateType(kind, typeKey, command);
      if (result.success && result.data) {
        applyTypeDetail(result.data);
        setSuccessMessage('Tipo aggiornato con successo.');
      } else if (result.error) setMutationError(result.error);
    });
  };

  const handleDisableType = async () => {
    if (!typeDetail) return;
    if (!typeDetail.isActive) {
      startTransition(async () => {
        const result = await AppCache.admin.enableType(kind, typeKey, { expectedRowVersion: typeDetail.rowVersion });
        if (result.success && result.data) {
          applyTypeDetail(result.data);
          setSuccessMessage('Tipo riattivato con successo.');
        } else if (result.error) setMutationError(result.error);
      });
      return;
    }
    const impact = await AppCache.admin.getTypeSchemaImpact(kind, typeKey, 'disable_type');
    if (!impact.success || !impact.data) {
      if (impact.error) setError(impact.error);
      return;
    }
    if (impact.data.blockingReasons.length > 0) {
      setError({ code: 'VALIDATION_ERROR', message: impact.data.blockingReasons.join(' ') });
      return;
    }
    setConfirmationImpact(impact.data.warnings.join(' '));
    setShowDisableConfirm(true);
  };

  const confirmDisableType = () => {
    if (!typeDetail) return;
    setShowDisableConfirm(false);
    setError(null);
    setConflictError(null);
    const command: DisableTypeUiCommand = { expectedRowVersion: typeDetail.rowVersion };
    startTransition(async () => {
      const result = await AppCache.admin.disableType(kind, typeKey, command);
      if (result.success && result.data) {
        applyTypeDetail(result.data);
        setSuccessMessage('Tipo disabilitato con successo.');
      } else if (result.error) setMutationError(result.error);
    });
  };

  const handleDeleteField = async (fieldId: string, fieldLabel: string) => {
    if (!typeDetail) return;
    const impact = await AppCache.admin.getTypeSchemaImpact(kind, typeKey, 'remove_field', fieldId);
    if (!impact.success || !impact.data) {
      if (impact.error) setError(impact.error);
      return;
    }
    if (impact.data.blockingReasons.length > 0) {
      setError({ code: 'VALIDATION_ERROR', message: impact.data.blockingReasons.join(' ') });
      return;
    }
    setConfirmationImpact(impact.data.warnings.join(' '));
    setFieldToDelete({ id: fieldId, label: fieldLabel });
  };

  const confirmDeleteField = () => {
    if (!typeDetail || !fieldToDelete) return;
    const command: DeleteFieldUiCommand = { fieldId: fieldToDelete.id, expectedTypeRowVersion: typeDetail.rowVersion };
    setFieldToDelete(null);
    setError(null);
    setConflictError(null);
    startTransition(async () => {
      const result = await AppCache.admin.deleteField(kind, typeKey, command);
      if (result.success && result.data) {
        applyTypeDetail(result.data);
        setSuccessMessage('Campo rimosso.');
      } else if (result.error) setMutationError(result.error);
    });
  };

  const prepareRollback = async (auditId: string) => {
    const result = await AppCache.admin.getTypeSchemaRollbackPlan(kind, typeKey, auditId);
    if (result.success && result.data) {
      if (result.data.canApply) setRollbackPlan(result.data);
      else setError({ code: 'ROLLBACK_NOT_SUPPORTED', message: result.data.reason });
    } else if (result.error) setError(result.error);
  };

  const confirmRollback = () => {
    if (!typeDetail || !rollbackPlan) return;
    startTransition(async () => {
      const result = await AppCache.admin.rollbackTypeMetadata(kind, typeKey, rollbackPlan.auditId, typeDetail.rowVersion);
      setRollbackPlan(null);
      if (result.success && result.data) {
        applyTypeDetail(result.data);
        setSuccessMessage('Metadati ripristinati. È stato registrato un nuovo evento di audit.');
      } else if (result.error) setError(result.error);
    });
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (!typeDetail) return;
    const orderedFields = [...typeDetail.fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedFields.length) return;
    [orderedFields[index], orderedFields[targetIndex]] = [orderedFields[targetIndex], orderedFields[index]];
    const command: ReorderFieldsUiCommand = { orderedFieldIds: orderedFields.map((field) => field.id), expectedTypeRowVersion: typeDetail.rowVersion };
    startTransition(async () => {
      const result = await AppCache.admin.reorderFields(kind, typeKey, command);
      if (result.success && result.data) {
        applyTypeDetail(result.data);
        setSuccessMessage('Ordine dei campi aggiornato.');
      } else if (result.error) setMutationError(result.error);
    });
  };

  return {
    typeDetail, loading, error, conflictError, successMessage, typeName, typeDescription,
    showFieldModal: fieldEditor.showModal,
    editingField: fieldEditor.editingField,
    fieldFormError: fieldEditor.formError,
    showDisableConfirm, fieldToDelete, confirmationImpact, rollbackPlan, schemaHistory, schemaImpact,
    isPending: isTypePending || fieldEditor.isPending,
    fieldKey: fieldEditor.fieldKey, label: fieldEditor.label, columnName: fieldEditor.columnName,
    dataType: fieldEditor.dataType, enumMode: fieldEditor.enumMode, encryptionMode: fieldEditor.encryptionMode,
    isRequired: fieldEditor.isRequired, isUnique: fieldEditor.isUnique, isIndexed: fieldEditor.isIndexed,
    defaultValueText: fieldEditor.defaultValueText,
    relationTargetDomain: fieldEditor.relationTargetDomain,
    relationTargetTypeKey: fieldEditor.relationTargetTypeKey,
    relationTargetTypes: fieldEditor.relationTargetTypes,
    relationTargetTypesLoading: fieldEditor.relationTargetTypesLoading,
    setTypeName, setTypeDescription, setSuccessMessage,
    setFieldKey: fieldEditor.setFieldKey, setLabel: fieldEditor.setLabel, setColumnName: fieldEditor.setColumnName,
    setDataType: fieldEditor.setDataType, setEnumMode: fieldEditor.setEnumMode,
    setEncryptionMode: fieldEditor.setEncryptionMode, setIsRequired: fieldEditor.setIsRequired,
    setIsUnique: fieldEditor.setIsUnique, setIsIndexed: fieldEditor.setIsIndexed,
    setDefaultValueText: fieldEditor.setDefaultValueText,
    setRelationTargetDomain: fieldEditor.setRelationTargetDomain,
    setRelationTargetTypeKey: fieldEditor.setRelationTargetTypeKey,
    loadData, handleUpdateType, handleDisableType, confirmDisableType,
    cancelDisableType: () => setShowDisableConfirm(false),
    openAddFieldModal: fieldEditor.openAdd,
    openEditFieldModal: fieldEditor.openEdit,
    closeFieldModal: fieldEditor.close,
    handleSaveField: fieldEditor.handleSubmit,
    handleDeleteField, confirmDeleteField, cancelDeleteField: () => setFieldToDelete(null),
    prepareRollback, confirmRollback, cancelRollback: () => setRollbackPlan(null), handleMoveField,
  };
}
