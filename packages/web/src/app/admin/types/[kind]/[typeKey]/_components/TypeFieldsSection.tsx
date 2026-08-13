import type { FieldDto } from '@dashboard/core';
import { TypeFieldsTable } from '../../../_components/TypeFieldsTable';

interface TypeFieldsSectionProps {
  fields: FieldDto[];
  isEditable: boolean;
  isPending: boolean;
  onAdd: () => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onEdit: (field: FieldDto) => void;
  onDelete: (fieldId: string, label: string) => void;
}

export function TypeFieldsSection({ fields, isEditable, isPending, onAdd, onMove, onEdit, onDelete }: TypeFieldsSectionProps) {
  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div><h2 className="text-xl font-bold text-white">Campi del Tipo ({fields.length})</h2><p className="text-xs text-slate-400 mt-0.5">Configura i campi tipizzati. L&apos;ordine definisce il layout di rendering dei form.</p></div>
        {isEditable && <button type="button" onClick={onAdd} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 w-fit"><span>+</span> Aggiungi Campo</button>}
      </div>
      <TypeFieldsTable fields={fields} isEditable={isEditable} isPending={isPending} onMove={onMove} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}
