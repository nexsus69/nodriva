'use client';

import { useParams } from 'next/navigation';
import { LockBadge } from '../../../../../components/LockBadge';
import { LockIndicator } from '../../../../../components/LockIndicator';
import { NodeBreadcrumb } from '../../../../../components/navigation/NodeBreadcrumb';
import { ConfirmModal } from '../../../../../components/ui/ConfirmModal';
import { Skeleton, SkeletonState } from '../../../../../components/ui/feedback';
import { PageShell, Panel } from '../../../../../components/ui/layout';
import { EntityResourceMenu } from '../../../../../components/ui/menu';
import { EntityDetailContent } from './EntityDetailContent';
import { useEntityDetailController } from '../_hooks/useEntityDetailController';

export function EntityDetailScreen() {
  const { nodeId, entityId } = useParams<{ nodeId: string; entityId: string }>();
  const controller = useEntityDetailController(entityId, nodeId);
  if (controller.isLoading || !controller.entity) return <PageShell className="max-w-2xl"><div className="flex min-w-0 items-center gap-1"><NodeBreadcrumb nodeId={nodeId} currentNodeLinkable /><span className="text-slate-400">/</span><Skeleton className="h-3 w-20" /></div>{controller.isError ? <Panel className="border-rose-200 bg-rose-50 text-xs text-rose-700">Errore: {controller.error?.message}</Panel> : <><Panel><SkeletonState label="Caricamento intestazione entità" className="flex items-center gap-3"><div className="flex-1 space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-6 w-1/2" /><Skeleton className="h-3 w-1/3" /></div><Skeleton className="h-8 w-24 rounded-full" /></SkeletonState></Panel><Panel><SkeletonState label="Caricamento campi entità" className="grid grid-cols-1 gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((field) => <div key={field} className="space-y-2"><Skeleton className="h-2.5 w-20" /><Skeleton className="h-9 w-full" /></div>)}</SkeletonState></Panel></>}</PageShell>;
  const entity = controller.entity;
  return <PageShell className="max-w-2xl">
    <ConfirmModal open={controller.deleteOpen} title="Elimina entità" message="Sei sicuro di voler eliminare questa entità?" confirmLabel="Elimina" onCancel={() => controller.setDeleteOpen(false)} onConfirm={controller.confirmDelete} busy={controller.isPending} />
    <div className="flex min-w-0 items-center gap-1"><NodeBreadcrumb nodeId={nodeId} currentNodeLinkable /><span className="text-slate-400">/</span><span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-mono font-semibold text-slate-800"><span className="truncate">{entity.name}</span><LockIndicator resourceType="entity" resourceId={entity.id} /></span></div>
    <Panel className="flex flex-col gap-4 p-4 text-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="min-w-0"><span className="block break-all text-[10px] font-mono uppercase text-indigo-600">ID Entità: {entity.id}</span><h1 className="mt-1 flex items-center gap-1 text-xl font-bold"><span>{entity.name}</span><EntityResourceMenu entityId={entity.id} entityName={entity.name} parentNodeId={nodeId} onEdit={() => void controller.beginEditing()} editDisabled={controller.lock.isMyLock} /></h1><p className="mt-1 text-xs text-slate-500">Tipo: {controller.entityType?.name ?? entity.entityTypeId} (V: {entity.rowVersion})</p></div><LockBadge lockedByOther={controller.lock.lockedByOther} isMyLock={controller.lock.isMyLock} acquireLock={controller.beginEditing} releaseLock={async () => { await controller.cancelEditing(); }} error={controller.lock.error} /></Panel>
    {controller.errorMessage && <Feedback tone="rose" label="Errore" message={controller.errorMessage} />}{controller.successMessage && <Feedback tone="emerald" label="Esito" message={controller.successMessage} />}{controller.lock.error && <Feedback tone="amber" label="Lock" message={controller.lock.error} />}
    <EntityDetailContent entity={entity} fields={controller.fields} payload={controller.payload} entityTypes={controller.entityTypesList} siblingEntities={controller.siblingEntities} attachmentsByField={controller.attachments} name={controller.name} description={controller.description} isMyLock={controller.lock.isMyLock} isPending={controller.isPending} setPayload={controller.setPayload} setAttachmentsByField={controller.setAttachments} setName={controller.setName} setDescription={controller.setDescription} onSubmit={controller.save} onCancel={controller.cancelEditing} onDelete={() => controller.setDeleteOpen(true)} />
  </PageShell>;
}

function Feedback({ tone, label, message }: { tone: 'rose' | 'emerald' | 'amber'; label: string; message: string }) { const classes = { rose: 'bg-rose-50 border-rose-200 text-rose-700', emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700', amber: 'bg-amber-50 border-amber-200 text-amber-700' }; return <div className={`p-4 rounded-xl border text-xs ${classes[tone]}`}><strong>{label}:</strong> {message}</div>; }
