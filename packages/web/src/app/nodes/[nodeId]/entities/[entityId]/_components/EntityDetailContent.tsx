/** Presents entity values and composes the shared metadata-driven entity editor. */
import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import type { ClientEntity } from '../../../../../types/models';
import { Panel } from '../../../../../components/ui/layout';
import {
  AttachmentList,
  applyResourceFormDraftChange,
  buildResourceIdentityFields,
  flattenResourceFormDraft,
  RelationValue,
  ResourceFormRenderer,
  type DynamicField,
} from '../../../../../components/ui/forms';

interface EntityDetailContentProps {
  entity: ClientEntity;
  fields: DynamicField[];
  payload: Record<string, unknown>;
  attachmentsByField: Record<string, readonly File[]>;
  name: string;
  description: string;
  isMyLock: boolean;
  isPending: boolean;
  formStale: boolean;
  setPayload: Dispatch<SetStateAction<Record<string, unknown>>>;
  setAttachmentsByField: Dispatch<SetStateAction<Record<string, readonly File[]>>>;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
  onDelete: () => void;
}

/** Renders read-only field values or the standard editable resource form. */
export function EntityDetailContent(props: EntityDetailContentProps) {
  const visibleFields = props.fields.length > 0
    ? props.fields
    : Object.keys(props.entity.payload ?? {}).map((fieldKey) => ({
      fieldKey,
      label: fieldKey,
      dataType: 'string',
    } as DynamicField));
  const attachmentFields = props.fields.filter((field) => (
    ['file', 'image'].includes(field.dataType.toLowerCase())
  ));
  const attachmentKeys = new Set(
    attachmentFields.map((field) => field.fieldKey),
  );
  const dynamicFieldNames = props.fields.map((field) => field.fieldKey);
  const formValues = flattenResourceFormDraft({
    name: props.name,
    description: props.description,
    payload: props.payload,
    attachments: props.attachmentsByField,
  });

  return (
    <>
      <Panel className="space-y-6 p-4 sm:p-6">
        {!props.isMyLock ? (
          <dl className="space-y-4 text-xs">
            <div>
              <dt className="mb-1 text-slate-500">Nome</dt>
              <dd className="text-slate-900">{props.entity.name}</dd>
            </div>
            <div>
              <dt className="mb-1 text-slate-500">Descrizione</dt>
              <dd className="text-slate-700">{props.entity.description || '—'}</dd>
            </div>
            <div>
              <dt className="mb-2 text-slate-500">Campi</dt>
              <dd className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleFields
                  .filter((field) => !['file', 'image'].includes(field.dataType.toLowerCase()))
                  .map((field) => {
                    const value = props.entity.payload?.[field.fieldKey];
                    const enumLabel = field.dataType === 'enum'
                      ? field.enumOptions?.find(
                        (option) => option.value === String(value),
                      )?.label
                      : undefined;
                    return (
                      <div
                        key={field.fieldKey}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">
                          {field.label ?? field.fieldKey}
                        </div>
                        <div className={`mt-1 break-words text-slate-800 ${
                          field.dataType === 'relation' ? 'font-mono text-[11px]' : ''
                        }`}>
                          {field.dataType === 'relation'
                            && (typeof value === 'string' || Array.isArray(value))
                            && field.relationTargetDomain
                            && field.relationTargetTypeKey ? (
                              <RelationValue
                                value={value}
                                resourceType={field.relationTargetDomain}
                                typeKey={field.relationTargetTypeKey}
                              />
                            ) : value === null || value === undefined || value === '' ? (
                              '—'
                            ) : typeof value === 'boolean' ? (
                              value ? 'Sì' : 'No'
                            ) : (
                              enumLabel ?? String(value)
                            )}
                        </div>
                      </div>
                    );
                  })}
              </dd>
            </div>
          </dl>
        ) : (
          <ResourceFormRenderer
            baseFields={buildResourceIdentityFields({
              nameLabel: 'Nome entità',
              descriptionLabel: 'Descrizione',
              descriptionRows: 2,
            })}
            fields={props.fields}
            values={formValues}
            onChange={(fieldName, value) => applyResourceFormDraftChange(
              fieldName,
              value,
              {
                attachmentFieldKeys: attachmentKeys,
                onNameChange: props.setName,
                onDescriptionChange: props.setDescription,
                onPayloadChange: (fieldKey, nextValue) => props.setPayload(
                  (current) => ({ ...current, [fieldKey]: nextValue }),
                ),
                onAttachmentsChange: (fieldKey, files) => props.setAttachmentsByField(
                  (current) => ({ ...current, [fieldKey]: files }),
                ),
              },
            )}
            onSubmit={props.onSubmit}
            onCancel={props.onCancel}
            destructiveAction={{ label: 'Elimina', onClick: props.onDelete }}
            isPending={props.isPending}
            submitDisabled={!props.name.trim() || props.formStale}
            submitLabel="Salva modifiche"
            pendingLabel="Salvataggio…"
            cancelLabel="Annulla"
            theme="light"
            definition={{
              key: 'edit-entity',
              version: '1',
              layout: { columns: 2, gap: 'normal' },
              sections: [
                {
                  key: 'identity',
                  label: 'Informazioni principali',
                  fieldNames: ['name', 'description'],
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
          />
        )}
      </Panel>
      {attachmentFields.map((field) => (
        <Panel key={field.fieldKey} className="space-y-3 p-4 text-slate-900 sm:p-6">
          <h2 className="text-sm font-semibold">{field.label ?? field.fieldKey}</h2>
          <AttachmentList
            resourceType="entity"
            resourceId={props.entity.id}
            fieldKey={field.fieldKey}
            kind={field.dataType.toLowerCase() as 'file' | 'image'}
            tone="light"
            canDelete={props.isMyLock}
          />
        </Panel>
      ))}
    </>
  );
}
