'use client';

/** Builds an entity draft through the same metadata-driven form contract as nodes. */
import Link from '@/app/components/navigation/GuardedLink';
import { useParams } from 'next/navigation';
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
import { useAppLocale } from '@/app/i18n/AppLocaleStore';
import { MutationFeedback } from '@/app/mutations/MutationFeedback';

/** Renders entity creation from stable identity fields and the selected type definition. */
export function CreateEntityScreen() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const controller = useCreateEntity(nodeId);
  const { t } = useAppLocale();
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
  const formTheme = 'dark' as const;
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
        href={controller.returnTo}
        className="text-xs font-mono text-slate-400 hover:text-slate-200"
      >
        ← {t('resource.returnToOrigin')}
      </Link>
      <Panel className="space-y-6 border-slate-800 bg-slate-900 text-slate-100">
        <div>
          <h1 className="text-xl font-bold text-slate-100">{t('resource.newOperationalEntity')}</h1>
          <p className="mt-1 text-xs text-slate-400">
            {t('resource.newEntityDescription')}
          </p>
        </div>
        {controller.error && !controller.mutationFailure && (
          <Alert tone="danger" className="bg-rose-500/10 text-rose-300">
            {controller.error}
          </Alert>
        )}
        <MutationFeedback failure={controller.mutationFailure} onRetry={controller.retryMutation} />
        <ResourceFormRenderer
          baseFields={buildResourceIdentityFields({
            type: { name: 'typeKey', label: t('resource.entityType'), options: typeOptions },
            nameLabel: t('resource.entityName'),
            descriptionLabel: t('resource.description'),
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
            !controller.name || !controller.typeKey
          }
          submitLabel={t('resource.createEntity')}
          pendingLabel={t('resource.creating')}
          cancelLabel={t('common.cancel')}
          theme={formTheme}
          definition={{
            key: 'create-entity',
            version: '1',
            layout: { columns: 2, gap: 'normal' },
            sections: [
              {
                key: 'identity',
                label: t('node.mainInformation'),
                fieldNames: ['typeKey', 'name', 'description'],
                columns: 2,
              },
              {
                key: 'fields',
                label: t('node.typeFields'),
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
                    onClick={() => controller.enumOption.open(field)}
                    className="block text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                  >
                    + {t('form.addOption')}
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
                      + {t('form.createRelatedInstance').replace('{type}', targetType.name)}
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
      {controller.enumOption.field && (
        <EnumOptionModal
          open
          values={controller.enumOption.values}
          pending={controller.enumOption.pending}
          failure={controller.enumOption.failure}
          theme={formTheme}
          onChange={controller.enumOption.change}
          onSubmit={(event) => { event.preventDefault(); void controller.enumOption.submit(); }}
          onRetry={controller.enumOption.retry}
          onClose={controller.enumOption.close}
          onDiscard={controller.enumOption.discard}
        />
      )}
    </PageShell>
  );
}
