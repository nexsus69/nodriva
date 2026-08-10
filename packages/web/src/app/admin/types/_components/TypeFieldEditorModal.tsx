import type { FormEventHandler } from 'react';
import type { ApiErrorResponse, FieldDataType, FieldDto, TypeListItemDto, FieldEncryptionMode } from '@dashboard/core';
import { AdminModalShell } from '../../_components/AdminModalShell';

export interface TypeFieldEditorModalProps {
  editingField: FieldDto | null;
  fieldFormError: ApiErrorResponse | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  fieldKey: string;
  setFieldKey: (value: string) => void;
  label: string;
  setLabel: (value: string) => void;
  columnName: string;
  setColumnName: (value: string) => void;
  dataType: FieldDataType;
  setDataType: (value: FieldDataType) => void;
  enumMode: 'static' | 'managed';
  setEnumMode: (value: 'static' | 'managed') => void;
  encryptionMode: FieldEncryptionMode;
  setEncryptionMode: (value: FieldEncryptionMode) => void;
  defaultValueText: string;
  setDefaultValueText: (value: string) => void;
  isRequired: boolean;
  setIsRequired: (value: boolean) => void;
  isUnique: boolean;
  setIsUnique: (value: boolean) => void;
  isIndexed: boolean;
  setIsIndexed: (value: boolean) => void;
  relationTargetDomain: 'node' | 'entity';
  setRelationTargetDomain: (value: 'node' | 'entity') => void;
  relationTargetTypeKey: string;
  setRelationTargetTypeKey: (value: string) => void;
  relationTargetTypes: readonly TypeListItemDto[];
  relationTargetTypesLoading: boolean;
}

export function TypeFieldEditorModal({
  editingField, fieldFormError, isPending, onClose, onSubmit,
  fieldKey, setFieldKey, label, setLabel, columnName, setColumnName,
  dataType, setDataType, enumMode, setEnumMode, encryptionMode, setEncryptionMode, defaultValueText, setDefaultValueText,
  isRequired, setIsRequired, isUnique, setIsUnique, isIndexed, setIsIndexed,
  relationTargetDomain, setRelationTargetDomain, relationTargetTypeKey, setRelationTargetTypeKey,
  relationTargetTypes, relationTargetTypesLoading,
}: TypeFieldEditorModalProps) {
  return (
    <AdminModalShell className="max-w-lg bg-slate-900 border-slate-700/80 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3"><h3 className="text-xl font-bold text-white">{editingField ? `Modifica Campo '${editingField.label}'` : 'Aggiungi Nuovo Campo'}</h3><button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold">✕</button></div>
        {fieldFormError && <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-red-300 text-xs"><div>⚠️ {fieldFormError.message}</div>{fieldFormError.details && fieldFormError.details.length > 0 && <ul className="mt-1 list-disc list-inside text-red-200/90">{fieldFormError.details.map((detail, index) => <li key={`${detail.field ?? 'field'}-${index}`}>{detail.field ? `${detail.field}: ` : ''}{detail.message}</li>)}</ul>}</div>}
        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          {!editingField && <>
            <div><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Field Key *</label><input type="text" required placeholder="es. serial_number" pattern="[a-z][a-z0-9_]*" title="Usa solo snake_case minuscolo, ad esempio customer_id" value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono text-xs" /></div>
            <div><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Nome Colonna Fisica (DB) *</label><input type="text" required placeholder="es. serial_number" pattern="[a-z][a-z0-9_]*" title="Usa solo snake_case minuscolo, ad esempio customer_id" value={columnName} onChange={(event) => setColumnName(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono text-xs" /><p className="mt-1 text-[11px] text-slate-500">Per file e immagini è un identificatore logico: il contenuto viene salvato nello storage allegati.</p></div>
            <div><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Tipo di Dato *</label><select value={dataType} onChange={(event) => setDataType(event.target.value as FieldDataType)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"><option value="string">String</option><option value="text">Text (lungo)</option><option value="integer">Integer</option><option value="number">Number</option><option value="decimal">Decimal</option><option value="boolean">Boolean</option><option value="date">Date</option><option value="datetime">Date e ora</option><option value="uuid">UUID</option><option value="json">JSON</option><option value="enum">Enum</option><option value="relation">Relazione (UUID)</option><option value="array">Array (JSON)</option><option value="file">File</option><option value="image">Immagine</option></select></div>
            {dataType === 'enum' && <div><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Gestione opzioni</label><select value={enumMode} onChange={(event) => setEnumMode(event.target.value as 'static' | 'managed')} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"><option value="static">Statica — solo configurazione amministrativa</option><option value="managed">Gestita — aggiungibile dal frontend autorizzato</option></select></div>}
          </>}
          {dataType === 'relation' && !editingField && <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Dominio target *</label><select value={relationTargetDomain} onChange={(event) => { setRelationTargetDomain(event.target.value as 'node' | 'entity'); setRelationTargetTypeKey(''); }} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"><option value="entity">Entità</option><option value="node">Nodo</option></select></div><div><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Type key target *</label><select required value={relationTargetTypeKey} disabled={relationTargetTypesLoading} onChange={(event) => setRelationTargetTypeKey(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"><option value="">{relationTargetTypesLoading ? 'Caricamento tipi...' : 'Seleziona un tipo'}</option>{relationTargetTypes.map((target) => <option key={target.id} value={target.typeKey}>{target.name} ({target.typeKey})</option>)}</select></div></div>}
          <div><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Label (UI) *</label><input type="text" required placeholder="es. Numero di Seriale" value={label} onChange={(event) => setLabel(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500" /></div>
          <div><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Valore di Default (Testo)</label><input type="text" placeholder="Valore opzionale di default" value={defaultValueText} onChange={(event) => setDefaultValueText(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs" /></div>
          <div><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Protezione del campo</label><select value={encryptionMode} onChange={(event) => setEncryptionMode(event.target.value as FieldEncryptionMode)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"><option value="plaintext">Non cifrare</option><option value="encrypted">Cifra campo quando la globale è attiva</option></select><p className="text-[11px] text-slate-400 mt-1">La cifratura globale deve essere attiva; i campi cifrati non sono ricercabili o indicizzabili.</p></div>
          <div className="grid grid-cols-3 gap-3 pt-2">{([['Obbligatorio', isRequired, setIsRequired], ['Unico', isUnique, setIsUnique], ['Indicizzato', isIndexed, setIsIndexed]] as const).map(([text, checked, setChecked]) => <label key={text} className="flex items-center gap-2 cursor-pointer bg-slate-950 p-2.5 rounded-lg border border-slate-800"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="accent-indigo-600" /><span className="text-xs font-medium text-slate-300">{text}</span></label>)}</div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800"><button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg">Annulla</button><button type="submit" disabled={isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-md disabled:opacity-50">{isPending ? 'Salvataggio...' : editingField ? 'Salva Campo' : 'Crea Campo'}</button></div>
        </form>
    </AdminModalShell>
  );
}
