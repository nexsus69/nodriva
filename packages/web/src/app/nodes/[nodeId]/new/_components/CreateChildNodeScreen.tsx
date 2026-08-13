'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LockBadge } from '../../../../components/LockBadge';
import { Alert } from '../../../../components/ui/feedback';
import { AttachmentInput, DynamicFieldsForm, EnumOptionModal } from '../../../../components/ui/forms';
import { PageShell, Panel } from '../../../../components/ui/layout';
import { isAttachmentField } from '../../../../components/ui/forms/dynamicResourceForm';
import { useCreateChildNode } from '../_hooks/useCreateChildNode';

const fieldClass = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500';

export function CreateChildNodeScreen() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const controller = useCreateChildNode(nodeId);
  return <PageShell className="max-w-xl"><Link href={`/nodes/${nodeId}`} className="text-xs text-slate-400 hover:text-slate-200 font-mono">← Torna al Nodo Padre</Link><Panel className="space-y-6 border-slate-800 bg-slate-900 text-slate-100">
    <div><h1 className="text-xl font-bold text-slate-100"><span>🌿</span> Crea nuovo sottonodo</h1><p className="text-xs text-slate-400 mt-1">Aggiunge un elemento figlio alla gerarchia sotto il nodo corrente.</p></div>
    {controller.error && <Alert tone="danger" className="bg-rose-500/10 text-rose-300">{controller.error}</Alert>}
    <LockBadge lockedByOther={controller.lock.lockedByOther} isMyLock={controller.lock.isMyLock} acquireLock={controller.lock.acquireLock} releaseLock={controller.lock.releaseLock} error={controller.lock.error} />
    <form onSubmit={controller.submit} className="space-y-4">
      <label className="block text-xs font-medium text-slate-300">Tipo Nodo *<select value={controller.typeKey} onChange={(event) => controller.setTypeKey(event.target.value)} className={`${fieldClass} mt-1 font-mono`}>{controller.nodeTypesList.map((type) => <option key={type.id} value={type.typeKey}>{type.name} ({type.typeKey})</option>)}</select></label>
      <label className="block text-xs font-medium text-slate-300">Nome Nodo *<input required value={controller.name} onChange={(event) => controller.setName(event.target.value)} className={`${fieldClass} mt-1`} /></label>
      <label className="block text-xs font-medium text-slate-300">Descrizione<textarea rows={3} value={controller.description} onChange={(event) => controller.setDescription(event.target.value)} className={`${fieldClass} mt-1`} /></label>
      <DynamicFieldsForm fields={controller.fields} payload={controller.payload} setPayload={controller.setPayload} onAddEnumOption={controller.setEnumField} />
      {controller.fields.filter(isAttachmentField).map((field) => <label key={field.fieldKey} className="block text-xs font-medium text-slate-300">{field.label ?? field.fieldKey}<span className="mt-2 block"><AttachmentInput kind={field.dataType.toLowerCase() as 'file' | 'image'} maxFiles={10} maxSizeBytes={25 * 1024 * 1024} value={controller.attachments[field.fieldKey] ?? []} onChange={(files) => controller.setAttachments((current) => ({ ...current, [field.fieldKey]: files }))} /></span></label>)}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80"><Link href={`/nodes/${nodeId}`} className="px-4 py-2 text-xs text-slate-400">Annulla</Link><button type="submit" disabled={controller.isPending || !controller.name || !controller.lock.isMyLock} className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white disabled:opacity-50">{controller.isPending ? 'Creazione...' : 'Crea Sotto-Nodo'}</button></div>
    </form>
  </Panel>{controller.enumField && <EnumOptionModal kind="node" typeKey={controller.typeKey} fieldId={controller.enumField.id!} onClose={() => controller.setEnumField(null)} onError={controller.setError} onOptionAdded={controller.addEnumOption} />}</PageShell>;
}
