import type { FormEvent, ReactNode } from 'react';
import { PasswordInput } from './PasswordInput';

export interface FormOption {
  value: string;
  label: string;
}

export type FormFieldSchema =
  | { name: string; type: 'text' | 'email' | 'password'; label: string; required?: boolean; placeholder?: string; autoComplete?: string }
  | { name: string; type: 'select'; label: string; required?: boolean; options: readonly FormOption[] }
  | { name: string; type: 'textarea'; label: string; required?: boolean; placeholder?: string; rows?: number }
  | { name: string; type: 'number'; label: string; required?: boolean; min?: number; step?: number; placeholder?: string; autoComplete?: string }
  | { name: string; type: 'boolean'; label: string };

export interface FormRendererProps {
  fields: readonly FormFieldSchema[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isPending?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  children?: ReactNode;
}

const fieldClassName = 'w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500';

export function FormRenderer({ fields, values, onChange, onSubmit, isPending = false, submitLabel = 'Salva', pendingLabel = 'Salvataggio...', children }: FormRendererProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {fields.map((field) => {
        if (field.type === 'boolean') {
          return <label key={field.name} className="flex items-center gap-2 pt-2 text-xs text-slate-300"><input type="checkbox" checked={Boolean(values[field.name])} onChange={(event) => onChange(field.name, event.target.checked)} className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500" />{field.label}</label>;
        }

        return (
          <div key={field.name}>
            <label className="block text-xs font-medium text-slate-300 mb-1">{field.label}{field.required ? ' *' : ''}</label>
            {field.type === 'select' ? (
              <select required={field.required} value={String(values[field.name] ?? '')} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClassName}>
                <option value="">Seleziona un valore</option>
                {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : field.type === 'password' ? (
              <PasswordInput required={field.required} autoComplete={field.autoComplete} value={String(values[field.name] ?? '')} onChange={(value) => onChange(field.name, value)} placeholder={field.placeholder} />
            ) : field.type === 'textarea' ? (
              <textarea required={field.required} rows={field.rows ?? 3} value={String(values[field.name] ?? '')} placeholder={field.placeholder} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClassName} />
            ) : (
              <input required={field.required} type={field.type} min={field.type === 'number' ? field.min : undefined} step={field.type === 'number' ? field.step : undefined} value={String(values[field.name] ?? '')} placeholder={field.placeholder} autoComplete={field.autoComplete} onChange={(event) => onChange(field.name, event.target.value)} className={fieldClassName} />
            )}
          </div>
        );
      })}
      {children}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50">{isPending ? pendingLabel : submitLabel}</button>
      </div>
    </form>
  );
}
