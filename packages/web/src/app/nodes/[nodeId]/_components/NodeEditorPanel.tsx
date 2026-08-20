import { LockBadge } from '../../../components/LockBadge';
import { Panel, SectionHeader } from '../../../components/ui/layout';
import { NodeResourceMenu } from '../../../components/ui/menu';
import { AttachmentInput, AttachmentList, DynamicFieldsForm } from '../../../components/ui/forms';
import { Skeleton } from '../../../components/ui/feedback';
import type { useNodeDetail } from '../_hooks/useNodeDetail';

interface NodeEditorPanelProps { nodeId: string; controller: ReturnType<typeof useNodeDetail> }

export function NodeEditorPanel({ nodeId, controller }: NodeEditorPanelProps) {
  const attachmentFields = controller.dynamicNodeFields.filter((field) => ['file', 'image'].includes(field.dataType.toLowerCase()));
  return (
    <>
      <Panel className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-xl text-indigo-600">📦</div>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                {controller.isNodeLoading || !controller.currentNode ? <span role="status" aria-label="Caricamento nodo"><Skeleton className="h-6 w-48" /></span> : <span className="min-w-0 break-words">{controller.currentNode.name}</span>}
                {controller.currentNode && <NodeResourceMenu nodeId={controller.currentNode.id} nodeName={controller.currentNode.name} onEdit={() => { void controller.beginNodeEditing(); }} />}
              </h1>
              {controller.isNodeLoading || !controller.currentNode ? <Skeleton className="mt-1 h-3 w-36" /> : <p className="mt-0.5 text-xs font-mono text-slate-400">Path: {controller.currentNode.pathLabel || controller.currentNode.path || '-'}</p>}
            </div>
            <DynamicFieldsForm fields={controller.dynamicNodeFields} payload={controller.dynamicNodePayload} setPayload={controller.setDynamicNodePayload} title="Campi dinamici" tone="light" />
            {controller.isMyLock && attachmentFields.map((field) => {
              const kind = field.dataType.toLowerCase() as 'file' | 'image';
              return (
                <div key={field.fieldKey} className="mt-3 space-y-2">
                  <span className="block text-xs font-medium text-slate-700">{field.label ?? field.fieldKey}</span>
                  <AttachmentInput kind={kind} tone="light" maxFiles={10} maxSizeBytes={25 * 1024 * 1024} value={controller.attachmentsByField[field.fieldKey] ?? []} onChange={(files) => controller.setAttachmentsByField((current) => ({ ...current, [field.fieldKey]: files }))} />
                </div>
              );
            })}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-mono uppercase text-slate-500">Version {controller.currentNode?.rowVersion || 1}</span>
            <LockBadge lockedByOther={controller.lockedByOther} isMyLock={controller.isMyLock} acquireLock={controller.beginNodeEditing} releaseLock={controller.exitEditMode} error={controller.lockError} />
          </div>
        </div>
        {controller.isMyLock ? (
          <form onSubmit={controller.handleUpdateNode} className="space-y-4 border-t border-slate-200 pt-4">
            <div>
              <label htmlFor="node-name" className="mb-1 block text-xs font-medium text-slate-700">Nome nodo *</label>
              <input id="node-name" name="name" type="text" required value={controller.nodeName} onChange={(event) => controller.setNodeName(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" />
            </div>
            <div>
              <label htmlFor="node-description" className="mb-1 block text-xs font-medium text-slate-700">Descrizione</label>
              <textarea id="node-description" name="description" rows={3} value={controller.nodeDescription} onChange={(event) => controller.setNodeDescription(event.target.value)} className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { void controller.exitEditMode(); }} disabled={controller.isSavingNode} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50">Annulla</button>
              <button type="submit" disabled={controller.isSavingNode || !controller.nodeName.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">{controller.isSavingNode ? 'Salvataggio…' : 'Salva modifiche'}</button>
            </div>
          </form>
        ) : controller.currentNode?.description ? <p className="border-t border-slate-200 pt-2 text-xs text-slate-500">{controller.currentNode.description}</p> : null}
      </Panel>

      {attachmentFields.map((field) => (
        <Panel key={field.fieldKey} className="space-y-3">
          <SectionHeader title={field.label ?? field.fieldKey} description={field.dataType.toLowerCase() === 'image' ? 'Immagini collegate al campo.' : 'Documenti collegati al campo.'} />
          <AttachmentList resourceType="node" resourceId={nodeId} fieldKey={field.fieldKey} kind={field.dataType.toLowerCase() as 'file' | 'image'} tone="light" canDelete={controller.isMyLock} />
        </Panel>
      ))}
    </>
  );
}
