import type { FieldDto } from '@dashboard/core';

export interface TypeFieldsTableProps {
  fields: readonly FieldDto[];
  isEditable: boolean;
  isPending: boolean;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onEdit: (field: FieldDto) => void;
  onDelete: (fieldId: string, fieldLabel: string) => void;
}

export function TypeFieldsTable({ fields, isEditable, isPending, onMove, onEdit, onDelete }: TypeFieldsTableProps) {
  if (fields.length === 0) {
    return <div className="p-8 text-center text-slate-400 text-sm">Nessun campo definito per questo tipo. Clicca su &quot;Aggiungi Campo&quot; per iniziare.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="admin-mobile-cards w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400 font-medium text-xs uppercase tracking-wider">
            <th className="py-3 px-3 w-16 text-center">Posizione</th>
            <th className="py-3 px-4">Label &amp; Key</th>
            <th className="py-3 px-4">Colonna Fisica</th>
            <th className="py-3 px-4">Tipo Dato</th>
            <th className="py-3 px-4">Proprietà</th>
            <th className="py-3 px-4 text-right">Azioni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {fields.map((field, index) => (
            <tr key={field.id} className="hover:bg-slate-800/20 transition-colors">
              <td data-label="Posizione" className="py-3 px-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  {isEditable && (
                    <>
                      <button type="button" disabled={index === 0 || isPending} onClick={() => onMove(index, 'up')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-20 text-xs font-bold" title="Sposta Su">▲</button>
                      <button type="button" disabled={index === fields.length - 1 || isPending} onClick={() => onMove(index, 'down')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-20 text-xs font-bold" title="Sposta Giù">▼</button>
                    </>
                  )}
                  <span className="font-mono text-xs text-slate-400 ml-1">#{field.position + 1}</span>
                </div>
              </td>
              <td data-label="Label e key" className="py-3 px-4">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  {field.label}
                  {field.isSystem && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-400 rounded">SYSTEM</span>}
                </div>
                <span className="font-mono text-xs text-indigo-300 block">{field.fieldKey}</span>
              </td>
              <td data-label="Colonna fisica" className="py-3 px-4 font-mono text-xs text-slate-300">{field.columnName}</td>
              <td data-label="Tipo dato" className="py-3 px-4 font-mono text-xs text-emerald-300">{field.dataType}</td>
              <td data-label="Proprietà" className="py-3 px-4 text-xs space-x-1.5">
                {field.isRequired && <span className="px-2 py-0.5 bg-red-950/50 text-red-300 border border-red-800/40 rounded text-[10px]">Required</span>}
                {field.isUnique && <span className="px-2 py-0.5 bg-purple-950/50 text-purple-300 border border-purple-800/40 rounded text-[10px]">Unique</span>}
                {field.isIndexed && <span className="px-2 py-0.5 bg-blue-950/50 text-blue-300 border border-blue-800/40 rounded text-[10px]">Indexed</span>}
                {field.defaultValueText && <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">Default: {field.defaultValueText}</span>}
              </td>
              <td data-label="" className="py-3 px-4 text-right space-x-2">
                {isEditable && !field.isSystem ? (
                  <>
                    <button type="button" onClick={() => onEdit(field)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors">Modifica</button>
                    <button type="button" onClick={() => onDelete(field.id, field.label)} className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 text-xs rounded transition-colors">Elimina</button>
                  </>
                ) : <span className="text-slate-500 text-xs italic">Read-only</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
