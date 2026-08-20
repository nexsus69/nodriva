import type { FormEvent } from 'react';
import type { ApiErrorResponse, ScopeAssignmentDto } from '@dashboard/core';
import { Skeleton } from '@/app/components/ui/feedback';
import { FormRenderer, type FormFieldSchema } from '../../../components/ui/forms';
import type { DelegableScopeLoadState } from '../_hooks/delegableScopeLoad';

const userFields: readonly FormFieldSchema[] = [
  { name: 'email', type: 'email', label: 'Email Utente', required: true, placeholder: 'utente@mate.com' },
  { name: 'password', type: 'password', label: 'Password Iniziale', required: true, placeholder: '12+ caratteri, maiuscola, minuscola, numero e simbolo', autoComplete: 'new-password' },
  { name: 'isSuperAdmin', type: 'boolean', label: 'Assegna Privilegio Super Admin' },
];

export interface UserCreateFormProps {
  values: { email: string; password: string; isSuperAdmin: boolean };
  scopes: readonly ScopeAssignmentDto[];
  selectedScopeIds: readonly string[];
  formError: ApiErrorResponse | null;
  scopeLoadState: DelegableScopeLoadState;
  scopeLoadError: ApiErrorResponse | null;
  isPending: boolean;
  onChange: (name: string, value: unknown) => void;
  onScopeToggle: (scopeId: string, checked: boolean) => void;
  onRetryScopes: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function UserCreateForm({ values, scopes, selectedScopeIds, formError, scopeLoadState, scopeLoadError, isPending, onChange, onScopeToggle, onRetryScopes, onSubmit }: UserCreateFormProps) {
  const scopeLoadBlocksSubmit = scopeLoadState === 'idle' || scopeLoadState === 'loading' || scopeLoadState === 'failed';
  return (
    <>
      {formError && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{formError.message}</div>}
      {scopeLoadState === 'loading' && <div role="status" aria-label="Caricamento ambiti delegabili" className="space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-8 w-full" /></div>}
      {scopeLoadState === 'restricted' && <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">Non disponi del permesso per assegnare ambiti iniziali. Puoi creare un account senza scope.</div>}
      {scopeLoadState === 'failed' && <div role="alert" className="space-y-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"><p>{scopeLoadError?.message ?? 'Impossibile verificare gli ambiti delegabili.'}</p><button type="button" onClick={onRetryScopes} className="font-semibold underline">Riprova</button></div>}
      <FormRenderer fields={userFields} values={values} onChange={onChange} onSubmit={onSubmit} isPending={isPending} submitDisabled={scopeLoadBlocksSubmit} submitLabel="Crea Account" pendingLabel="Creazione in corso...">
        {scopes.length > 0 && <fieldset className="space-y-2 border-t border-slate-800/80 pt-3"><legend className="text-xs font-medium text-slate-300">Ambiti iniziali delegabili</legend><p className="text-[11px] text-slate-500">Selezionando uno o più ambiti, l&apos;account viene creato in modo atomico senza ruoli globali.</p>{scopes.map((scope) => <label key={scope.id} className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={selectedScopeIds.includes(scope.id)} onChange={(event) => onScopeToggle(scope.id, event.target.checked)} className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500" />{scope.nodeName} · {scope.roleName} · {scope.propagation === 'subtree' ? 'sottoalbero' : 'solo nodo'}</label>)}</fieldset>}
      </FormRenderer>
    </>
  );
}
