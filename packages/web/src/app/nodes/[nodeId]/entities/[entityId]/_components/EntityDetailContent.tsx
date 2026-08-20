import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import type { ClientEntity, EntityTypeMeta } from '../../../../../types/models';
import { Panel } from '../../../../../components/ui/layout';
import { AttachmentInput, AttachmentList, DynamicFieldsForm, RelationValue, type DynamicField } from '../../../../../components/ui/forms';

interface EntityDetailContentProps {
  entity: ClientEntity;
  fields: DynamicField[];
  payload: Record<string, unknown>;
  entityTypes: readonly EntityTypeMeta[];
  siblingEntities: readonly ClientEntity[];
  attachmentsByField: Record<string, readonly File[]>;
  name: string;
  description: string;
  isMyLock: boolean;
  isPending: boolean;
  setPayload: Dispatch<SetStateAction<Record<string, unknown>>>;
  setAttachmentsByField: Dispatch<SetStateAction<Record<string, readonly File[]>>>;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
  onDelete: () => void;
}

export function EntityDetailContent(props: EntityDetailContentProps) {
  const visibleFields = props.fields.length > 0
    ? props.fields
    : Object.keys(props.entity.payload ?? {}).map((fieldKey) => ({ fieldKey, label: fieldKey, dataType: 'string' } as DynamicField));
  const attachmentFields = props.fields.filter((field) => ['file', 'image'].includes(field.dataType.toLowerCase()));

  return (
    <>
      <Panel className="space-y-6 p-4 sm:p-6">
        {!props.isMyLock ? (
          <dl className="space-y-4 text-xs">
            <div><dt className="text-slate-500 mb-1">Nome</dt><dd className="text-slate-900">{props.entity.name}</dd></div>
            <div><dt className="text-slate-500 mb-1">Descrizione</dt><dd className="text-slate-700">{props.entity.description || '—'}</dd></div>
            <div>
              <dt className="mb-2 text-slate-500">Campi</dt>
              <dd className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleFields.filter((field) => !['file', 'image'].includes(field.dataType.toLowerCase())).map((field) => {
                  const value = props.entity.payload?.[field.fieldKey];
                  const enumLabel = field.dataType === 'enum' ? field.enumOptions?.find((option) => option.value === String(value))?.label : undefined;
                  return (
                    <div key={field.fieldKey} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{field.label ?? field.fieldKey}</div>
                      <div className={`mt-1 break-words text-slate-800 ${field.dataType === 'relation' ? 'font-mono text-[11px]' : ''}`}>
                        {field.dataType === 'relation' && typeof value === 'string' && field.relationTargetDomain && field.relationTargetTypeKey
                          ? <RelationValue value={value} resourceType={field.relationTargetDomain} typeKey={field.relationTargetTypeKey} />
                          : value === null || value === undefined || value === '' ? '—' : typeof value === 'boolean' ? (value ? 'Sì' : 'No') : enumLabel ?? String(value)}
                      </div>
                    </div>
                  );
                })}
              </dd>
            </div>
          </dl>
        ) : (
          <form onSubmit={props.onSubmit} className="space-y-4">
            <div><label htmlFor="entity-name" className="block text-xs font-medium text-slate-700 mb-1">Nome Entità *</label><input id="entity-name" name="name" type="text" required value={props.name} onChange={(event) => props.setName(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500" /></div>
            <div><label htmlFor="entity-description" className="block text-xs font-medium text-slate-700 mb-1">Descrizione</label><textarea id="entity-description" name="description" rows={2} value={props.description} onChange={(event) => props.setDescription(event.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-indigo-500" /></div>
            <DynamicFieldsForm fields={props.fields} payload={props.payload} setPayload={props.setPayload} entityTypes={props.entityTypes} siblingEntities={props.siblingEntities.filter((candidate) => candidate.id !== props.entity.id)} tone="light" />
            {attachmentFields.map((field) => {
              const kind = field.dataType.toLowerCase() as 'file' | 'image';
              return <div key={field.fieldKey} className="space-y-2"><span className="block text-xs font-medium text-slate-700">{field.label ?? field.fieldKey}</span><AttachmentInput kind={kind} tone="light" maxFiles={10} maxSizeBytes={25 * 1024 * 1024} value={props.attachmentsByField[field.fieldKey] ?? []} onChange={(files) => props.setAttachmentsByField((current) => ({ ...current, [field.fieldKey]: files }))} /></div>;
            })}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={props.onCancel} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100">Annulla</button>
              <button type="button" onClick={props.onDelete} disabled={props.isPending} className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 disabled:opacity-50">Elimina</button>
              <button type="submit" disabled={props.isPending || !props.name} className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50">{props.isPending ? 'Salvataggio...' : 'Salva modifiche'}</button>
            </div>
          </form>
        )}
      </Panel>
      {attachmentFields.map((field) => <Panel key={field.fieldKey} className="space-y-3 p-4 text-slate-900 sm:p-6"><h2 className="text-sm font-semibold">{field.label ?? field.fieldKey}</h2><AttachmentList resourceType="entity" resourceId={props.entity.id} fieldKey={field.fieldKey} kind={field.dataType.toLowerCase() as 'file' | 'image'} tone="light" canDelete={props.isMyLock} /></Panel>)}
    </>
  );
}
