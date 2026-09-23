'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

export interface ManagedEnumOption {
  id: string;
  value: string;
  label: string;
  position: number;
  isActive: boolean;
}

export interface EnumOptionModalProps {
  kind: 'node' | 'entity';
  typeKey: string;
  fieldId: string;
  onClose: () => void;
  onOptionAdded: (option: ManagedEnumOption) => void;
  onError: (message: string) => void;
}

export function EnumOptionModal({ kind, typeKey, fieldId, onClose, onOptionAdded, onError }: EnumOptionModalProps) {
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useAppLocale();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    void (async () => {
      try {
        const result = await AppCache.admin.addEnumOption(kind, typeKey, fieldId, value.trim(), label.trim());
        if (!result.success || !result.data) {
          onError(result.error?.message ?? t('enum.addError'));
          return;
        }
        onOptionAdded(result.data);
        onClose();
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : t('enum.addError'));
      } finally {
        setIsSaving(false);
      }
    })();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <form className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onSubmit={handleSubmit}>
        <h2 className="text-lg font-bold text-slate-100">{t('enum.newOption')}</h2>
        <input required pattern="[a-z][a-z0-9_-]*" value={value} onChange={(event) => setValue(event.target.value)} placeholder={t('enum.technicalValuePlaceholder')} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
        <input required value={label} onChange={(event) => setLabel(event.target.value)} placeholder={t('enum.labelPlaceholder')} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs text-slate-300">{t('common.cancel')}</button>
          <button type="submit" disabled={isSaving} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{isSaving ? t('common.saving') : t('enum.saveOption')}</button>
        </div>
      </form>
    </div>
  );
}
