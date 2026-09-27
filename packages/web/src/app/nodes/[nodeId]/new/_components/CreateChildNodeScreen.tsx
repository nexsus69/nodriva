'use client';

/** Builds a child-node draft through the shared resource form lifecycle. */
import Link from '@/app/components/navigation/GuardedLink';
import { useParams } from 'next/navigation';
import { Alert } from '../../../../components/ui/feedback';
import {
  EnumOptionModal,
  applyResourceFormDraftChange,
  buildResourceIdentityFields,
  flattenResourceFormDraft,
  ResourceFieldActions,
  ResourceFormRenderer,
} from '../../../../components/ui/forms';
import { PageShell, Panel } from '../../../../components/ui/layout';
import { isAttachmentField } from '../../../../components/ui/forms/dynamicResourceForm';
import { useCreateChildNode } from '../_hooks/useCreateChildNode';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';
import { MutationFeedback } from '@/app/mutations/MutationFeedback';
import { SITE_THEME } from '@/Theme';

/** Renders the node-creation screen from standard fields plus selected type metadata. */
export function CreateChildNodeScreen() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const controller = useCreateChildNode(nodeId);
  const { t } = useAppLocale();
  const attachmentKeys = new Set(
    controller.fields.filter(isAttachmentField).map((field) => field.fieldKey),
  );
  const fieldByKey = new Map(
    controller.fields.map((field) => [field.fieldKey, field]),
  );
  const typeOptions = controller.nodeTypesList.map((type) => ({
    value: type.typeKey,
    label: `${type.name} (${type.typeKey})`,
  }));
  const dynamicFieldNames = controller.fields.map((field) => field.fieldKey);
  const formTheme = SITE_THEME.form;
  const formValues = flattenResourceFormDraft({
    typeKey: controller.typeKey,
    name: controller.name,
    description: controller.description,
    payload: controller.payload,
    attachments: controller.attachments,
  });

  return (
    <PageShell className="max-w-2xl">
      <Link
        href={controller.returnTo}
        className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
      >
        ← {t('resource.returnToOrigin')}
      </Link>
      <Panel className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('resource.createChildNode')}</h1>
          <p className="mt-1 text-xs text-slate-600">
            {t('resource.createChildNodeDescription')}
          </p>
        </div>
        {controller.error && !controller.mutationFailure && (
          <Alert tone="danger">
            {controller.error}
          </Alert>
        )}
        <MutationFeedback failure={controller.mutationFailure} onRetry={controller.retryMutation} />
        <ResourceFormRenderer
          baseFields={buildResourceIdentityFields({
            type: { name: 'typeKey', label: t('resource.nodeType'), options: typeOptions },
            nameLabel: t('resource.nodeName'),
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
          submitDisabled={!controller.name}
          submitLabel={t('resource.createChildNode')}
          pendingLabel={t('resource.creating')}
          cancelLabel={t('common.cancel')}
          theme={formTheme}
          definition={{
            key: 'create-child-node',
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
            return <ResourceFieldActions field={field} onAddEnumOption={controller.enumOption.open} />;
          }}
        />
      </Panel>
      {controller.enumOption.field && (
        <EnumOptionModal
          open
          values={controller.enumOption.values}
          isDirty={controller.enumOption.isCurrentDirty}
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
