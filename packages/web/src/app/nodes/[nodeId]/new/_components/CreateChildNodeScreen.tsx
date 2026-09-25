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
  ResourceFormRenderer,
} from '../../../../components/ui/forms';
import { PageShell, Panel } from '../../../../components/ui/layout';
import { isAttachmentField } from '../../../../components/ui/forms/dynamicResourceForm';
import { useCreateChildNode } from '../_hooks/useCreateChildNode';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';
import { MutationFeedback } from '@/app/mutations/MutationFeedback';

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
          <h1 className="text-xl font-bold text-slate-100">{t('resource.createChildNode')}</h1>
          <p className="mt-1 text-xs text-slate-400">
            {t('resource.createChildNodeDescription')}
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
          theme="dark"
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
            if (!field || field.enumMode !== 'managed') return null;
            return (
              <button
                type="button"
                onClick={() => controller.setEnumField(field)}
                className="mt-2 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
              >
                + {t('form.addOption')}
              </button>
            );
          }}
        />
      </Panel>
      {controller.enumField && (
        <EnumOptionModal
          kind="node"
          typeKey={controller.typeKey}
          fieldId={controller.enumField.id!}
          onClose={() => controller.setEnumField(null)}
          onOptionAdded={controller.addEnumOption}
        />
      )}
    </PageShell>
  );
}
