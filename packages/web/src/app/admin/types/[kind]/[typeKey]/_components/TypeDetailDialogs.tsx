import { ConfirmModal } from '../../../../../components/ui/ConfirmModal';
import { TypeFieldEditorModal } from '../../../_components/TypeFieldEditorModal';
import type { useAdminTypeDetail } from '../_hooks/useAdminTypeDetail';

interface TypeDetailDialogsProps {
  controller: ReturnType<typeof useAdminTypeDetail>;
}

export function TypeDetailDialogs({ controller }: TypeDetailDialogsProps) {
  const { typeDetail } = controller;
  if (!typeDetail) return null;

  return (
    <>
      <ConfirmModal
        open={controller.showDisableConfirm}
        title="Disabilita tipo"
        message={`Sei sicuro di voler disabilitare il tipo '${typeDetail.name}'? ${controller.confirmationImpact}`}
        confirmLabel="Disabilita"
        onCancel={controller.cancelDisableType}
        onConfirm={controller.confirmDisableType}
        busy={controller.isPending}
      />
      <ConfirmModal
        open={controller.rollbackPlan !== null}
        title="Ripristina metadati del tipo"
        message={controller.rollbackPlan ? `${controller.rollbackPlan.reason} Ripristinare il nome '${controller.rollbackPlan.targetName}' e la descrizione dello stato storico?` : ''}
        confirmLabel="Ripristina"
        onCancel={controller.cancelRollback}
        onConfirm={controller.confirmRollback}
        busy={controller.isPending}
      />
      <ConfirmModal
        open={controller.fieldToDelete !== null}
        title="Rimuovi campo"
        message={controller.fieldToDelete ? `Rimuovere il campo '${controller.fieldToDelete.label}'? ${controller.confirmationImpact}` : ''}
        confirmLabel="Rimuovi"
        onCancel={controller.cancelDeleteField}
        onConfirm={controller.confirmDeleteField}
        busy={controller.isPending}
      />
      {controller.showFieldModal && (
        <TypeFieldEditorModal
          editingField={controller.editingField}
          fieldFormError={controller.fieldFormError}
          isPending={controller.isPending}
          onClose={controller.closeFieldModal}
          onSubmit={controller.handleSaveField}
          fieldKey={controller.fieldKey}
          setFieldKey={controller.setFieldKey}
          label={controller.label}
          setLabel={controller.setLabel}
          columnName={controller.columnName}
          setColumnName={controller.setColumnName}
          dataType={controller.dataType}
          setDataType={controller.setDataType}
          enumMode={controller.enumMode}
          setEnumMode={controller.setEnumMode}
          encryptionMode={controller.encryptionMode}
          setEncryptionMode={controller.setEncryptionMode}
          defaultValueText={controller.defaultValueText}
          setDefaultValueText={controller.setDefaultValueText}
          isRequired={controller.isRequired}
          setIsRequired={controller.setIsRequired}
          isUnique={controller.isUnique}
          setIsUnique={controller.setIsUnique}
          isIndexed={controller.isIndexed}
          setIsIndexed={controller.setIsIndexed}
          relationTargetDomain={controller.relationTargetDomain}
          setRelationTargetDomain={controller.setRelationTargetDomain}
          relationTargetTypeKey={controller.relationTargetTypeKey}
          setRelationTargetTypeKey={controller.setRelationTargetTypeKey}
          relationTargetTypes={controller.relationTargetTypes}
          relationTargetTypesLoading={controller.relationTargetTypesLoading}
        />
      )}
    </>
  );
}
