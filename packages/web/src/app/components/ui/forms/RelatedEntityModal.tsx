'use client';

/** Composes related-entity creation through the shared modal form lifecycle. */
import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import { SITE_THEME } from '@/Theme';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';
import { createValidationMessages, defineForm } from './FormDefinition';
import { DynamicFieldsForm, type DynamicField } from './DynamicFieldsForm';
import { FormModal } from './FormModal';

export interface RelatedEntityModalProps {
  fields: DynamicField[];
  payload: Record<string, unknown>;
  name: string;
  description: string;
  isDirty: boolean;
  isPending: boolean;
  setPayload: Dispatch<SetStateAction<Record<string, unknown>>>;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  onClose: () => void;
  onDiscard: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function RelatedEntityModal(props: RelatedEntityModalProps) {
  const { t } = useAppLocale();
  const definition = defineForm({
    key: 'related-entity',
    version: '1',
    fields: [
      { name: 'name', label: t('resource.entityName'), type: 'text', required: true, placeholder: t('related.namePlaceholder') },
      { name: 'description', label: t('resource.description'), type: 'textarea', rows: 2 },
    ],
    validationMessages: createValidationMessages(t),
  });

  return (
    <FormModal
      open
      title={t('related.newInstance')}
      isDirty={props.isDirty}
      definition={definition}
      values={{ name: props.name, description: props.description }}
      onChange={(field, value) => {
        if (field === 'name') props.setName(String(value));
        if (field === 'description') props.setDescription(String(value));
      }}
      onSubmit={props.onSubmit}
      isPending={props.isPending}
      submitLabel={t('related.createAndSelect')}
      pendingLabel={t('resource.creating')}
      cancelLabel={t('common.cancel')}
      theme={SITE_THEME.form}
      onClose={props.onClose}
      onDiscard={props.onDiscard}
    >
      <p className="-mt-2 text-xs text-slate-600">{t('related.newInstanceDescription')}</p>
      <DynamicFieldsForm fields={props.fields} payload={props.payload} setPayload={props.setPayload} title={t('related.instanceFields')} tone={SITE_THEME.form} />
    </FormModal>
  );
}
