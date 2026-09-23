import type { Dispatch, FormEventHandler, SetStateAction } from 'react';
import { DynamicFieldsForm, type DynamicField } from '../../../../../components/ui/forms';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

interface RelatedEntityModalProps {
  fields: DynamicField[];
  payload: Record<string, unknown>;
  name: string;
  description: string;
  isPending: boolean;
  setPayload: Dispatch<SetStateAction<Record<string, unknown>>>;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function RelatedEntityModal(props: RelatedEntityModalProps) {
  const { t } = useAppLocale();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div><h2 className="text-lg font-bold text-slate-100">{t('related.newInstance')}</h2><p className="mt-1 text-xs text-slate-400">{t('related.newInstanceDescription')}</p></div>
          <button type="button" onClick={props.onClose} aria-label={t('related.closeInstance')} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <form className="space-y-4" onSubmit={props.onSubmit}>
          <div><label htmlFor="related-entity-name" className="mb-1 block text-xs font-medium text-slate-300">{t('resource.entityName')} *</label><input id="related-entity-name" name="name" required value={props.name} onChange={(event) => props.setName(event.target.value)} placeholder={t('related.namePlaceholder')} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></div>
          <div><label htmlFor="related-entity-description" className="mb-1 block text-xs font-medium text-slate-300">{t('resource.description')}</label><textarea id="related-entity-description" name="description" value={props.description} onChange={(event) => props.setDescription(event.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></div>
          <DynamicFieldsForm fields={props.fields} payload={props.payload} setPayload={props.setPayload} title={t('related.instanceFields')} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={props.onClose} className="rounded-lg px-4 py-2 text-xs text-slate-300 hover:bg-slate-800">{t('common.cancel')}</button>
            <button type="submit" disabled={props.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{props.isPending ? t('resource.creating') : t('related.createAndSelect')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
