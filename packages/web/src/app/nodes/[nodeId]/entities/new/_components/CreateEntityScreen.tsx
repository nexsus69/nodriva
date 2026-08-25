'use client';

/** Builds an entity draft through the same metadata-driven form contract as nodes. */
import Link from '@/app/components/navigation/GuardedLink';
import { useParams } from 'next/navigation';
import { LockBadge } from '../../../../../components/LockBadge';
import { Alert } from '../../../../../components/ui/feedback';
import {
  EnumOptionModal,
  applyResourceFormDraftChange,
  buildResourceIdentityFields,
  flattenResourceFormDraft,
  ResourceFormRenderer,
} from '../../../../../components/ui/forms';
import { PageShell, Panel } from '../../../../../components/ui/layout';
import { isAttachmentField } from '../../../../../components/ui/forms/dynamicResourceForm';
import { RelatedEntityModal } from './RelatedEntityModal';
import { useCreateEntity } from '../_hooks/useCreateEntity';

/** Renders entity creation from stable identity fields and the selected type definition. */
export function CreateEntityScreen() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const controller = useCreateEntity(nodeId);
  const attachmentKeys = new Set(
    controller.fields.filter(isAttachmentField).map((field) => field.fieldKey),
  );
  const fieldByKey = new Map(
    controller.fields.map((field) => [field.fieldKey, field]),
  );
  const typeOptions = controller.entityTypesList.map((type) => ({
    value: type.typeKey,
    label: `${type.name} (${type.typeKey})`,
  }));
  const dynamicFieldNames = controller.fields.map((field) => field.fieldKey);
  const formValues = flattenResourceFormDraft({
    typeKey: controller.typeKey,
    name: controller.name,
    description: controller.description,
    payload: controller.payload,
    attachments: controller.attachments,
  });

  return (
    <PageShell className="max-w-xl">
      <Link
        href={`/nodes/${nodeId}`}
        className="text-xs font-mono text-slate-400 hover:text-slate-200"
      >
        ← Torna al nodo padre
      </Link>
      <Panel className="space-y-6 border-slate-800 bg-slate-900 text-slate-100">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Nuova entità operativa</h1>
          <p className="mt-1 text-xs text-slate-400">
            Crea una nuova entità compilando i dati di base e i campi dello schema.
          </p>
        </div>
        {controller.error && (
          <Alert tone="danger" className="bg-rose-500/10 text-rose-300">
            {controller.error}
          </Alert>
        )}
        <LockBadge
          lockedByOther={controller.lock.lockedByOther}
          isMyLock={controller.lock.isMyLock}
          acquireLock={controller.lock.acquireLock}
          releaseLock={controller.lock.releaseLock}
          error={controller.lock.error}
        />
        <ResourceFormRenderer
          baseFields={buildResourceIdentityFields({
            type: { name: 'typeKey', label: 'Tipo Entità', options: typeOptions },
            nameLabel: 'Nome Entità',
            descriptionLabel: 'Descrizione',
          })}
          fields={controller.fields}
          values={formValues}
          onChange={(fieldName, value) => applyResourceFormDraftChange(
            fieldName,
            value,
            {
              attachmentFieldKeys: attachmentKeys,
              onTypeKeyChange: controller.setTypeKey,
              onNameChange: controller.setName,
              onDescriptionChange: controller.setDescription,
              onPayloadChange: (fieldKey, nextValue) => controller.setPayload(
                (current) => ({ ...current, [fieldKey]: nextValue }),
              ),
              onAttachmentsChange: (fieldKey, files) => controller.setAttachments(
                (current) => ({ ...current, [fieldKey]: files }),
              ),
            },
          )}
          onSubmit={controller.submit}
          onCancel={() => { void controller.cancel(); }}
          isPending={controller.isPending}
          submitDisabled={
            !controller.name || !controller.typeKey || !controller.lock.isMyLock
          }
          submitLabel="Crea Entità"
          pendingLabel="Creazione…"
          cancelLabel="Annulla"
          theme="dark"
          definition={{
            key: 'create-entity',
            version: '1',
            layout: { columns: 2, gap: 'normal' },
            sections: [
              {
                key: 'identity',
                label: 'Informazioni principali',
                fieldNames: ['typeKey', 'name', 'description'],
                columns: 2,
              },
              {
                key: 'fields',
                label: 'Campi del tipo',
                fieldNames: dynamicFieldNames,
                columns: 2,
              },
            ],
          }}
          renderFieldAddon={(formField) => {
            const field = fieldByKey.get(formField.name);
            if (!field) return null;
            const targetType = controller.entityTypesList.find(
              (type) => type.typeKey === field.relationTargetTypeKey
                || type.id === field.relationTargetTypeKey,
            );
            return (
              <div className="mt-2 space-y-1">
                {field.enumMode === 'managed' && (
                  <button
                    type="button"
                    onClick={() => controller.setEnumField(field)}
                    className="block text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                  >
                    + Aggiungi opzione
                  </button>
                )}
                {field.dataType.toLowerCase() === 'relation'
                  && field.relationTargetDomain === 'entity'
                  && targetType && (
                    <button
                      type="button"
                      onClick={() => controller.related.open(field)}
                      className="block text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                    >
                      + Crea nuova istanza di {targetType.name}
                    </button>
                  )}
              </div>
            );
          }}
        />
      </Panel>
      {controller.related.field && (
        <RelatedEntityModal
          fields={controller.related.fields}
          payload={controller.related.payload}
          name={controller.related.name}
          description={controller.related.description}
          isPending={controller.related.pending}
          setPayload={controller.related.setPayload}
          setName={controller.related.setName}
          setDescription={controller.related.setDescription}
          onClose={controller.related.close}
          onSubmit={controller.related.submit}
        />
      )}
      {controller.enumField && (
        <EnumOptionModal
          kind="entity"
          typeKey={controller.typeKey}
          fieldId={controller.enumField.id!}
          onClose={() => controller.setEnumField(null)}
          onError={controller.setError}
          onOptionAdded={controller.addEnumOption}
        />
      )}
    </PageShell>
  );
}
