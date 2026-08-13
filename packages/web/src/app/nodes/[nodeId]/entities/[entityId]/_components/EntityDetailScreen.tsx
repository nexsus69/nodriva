'use client';

import Link from '@/app/components/navigation/GuardedLink';
import { useParams } from 'next/navigation';
import { LockBadge } from '../../../../../components/LockBadge';
import { LockIndicator } from '../../../../../components/LockIndicator';
import { NodeBreadcrumb } from '../../../../../components/navigation/NodeBreadcrumb';
import { ConfirmModal } from '../../../../../components/ui/ConfirmModal';
import { LoadingState } from '../../../../../components/ui/feedback';
import { PageShell, Panel } from '../../../../../components/ui/layout';
import { EntityResourceMenu } from '../../../../../components/ui/menu';
import { EntityDetailContent } from './EntityDetailContent';
import { useEntityDetailController } from '../_hooks/useEntityDetailController';

export function EntityDetailScreen() {
  const { nodeId, entityId } = useParams<{ nodeId: string; entityId: string }>();
  const controller = useEntityDetailController(entityId, nodeId);
  if (controller.isLoading || !controller.entity) return <PageShell className="max-w-xl"><Link href={`/nodes/${nodeId}`} className="text-xs text-slate-400 font-mono">← Torna al Nodo Padre</Link><Panel className="bg-slate-900 text-center text-slate-400">{controller.isError ? `Errore: ${controller.error?.message}` : <LoadingState label="Caricamento entità in corso…" />}</Panel></PageShell>;
  const entity = controller.entity;
  return <PageShell className="max-w-2xl">
    <ConfirmModal open={controller.deleteOpen} title="Elimina entità" message="Sei sicuro di voler eliminare questa entità?" confirmLabel="Elimina" onCancel={() => controller.setDeleteOpen(false)} onConfirm={controller.confirmDelete} busy={controller.isPending} />
    <div className="flex min-w-0 items-center gap-1"><NodeBreadcrumb nodeId={nodeId} currentNodeLinkable /><span className="text-slate-600">/</span><span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-mono font-semibold text-slate-100"><span className="truncate">{entity.name}</span><LockIndicator resourceType="entity" resourceId={entity.id} /></span></div>
    <Panel className="flex flex-col gap-4 border-slate-800 bg-slate-900 p-4 text-slate-100 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="min-w-0"><span className="block break-all text-[10px] font-mono uppercase text-indigo-400">ID Entità: {entity.id}</span><h1 className="mt-1 flex items-center gap-1 text-xl font-bold"><span>{entity.name}</span><EntityResourceMenu entityId={entity.id} entityName={entity.name} parentNodeId={nodeId} onEdit={() => void controller.beginEditing()} editDisabled={controller.lock.isMyLock} /></h1><p className="mt-1 text-xs text-slate-400">Tipo: {controller.entityType?.name ?? entity.entityTypeId} (V: {entity.rowVersion})</p></div><LockBadge lockedByOther={controller.lock.lockedByOther} isMyLock={controller.lock.isMyLock} acquireLock={controller.beginEditing} releaseLock={async () => { await controller.cancelEditing(); }} error={controller.lock.error} /></Panel>
    {controller.errorMessage && <Feedback tone="rose" label="Errore" message={controller.errorMessage} />}{controller.successMessage && <Feedback tone="emerald" label="Esito" message={controller.successMessage} />}{controller.lock.error && <Feedback tone="amber" label="Lock" message={controller.lock.error} />}
    <EntityDetailContent entity={entity} fields={controller.fields} payload={controller.payload} entityTypes={controller.entityTypesList} siblingEntities={controller.siblingEntities} attachmentsByField={controller.attachments} name={controller.name} description={controller.description} isMyLock={controller.lock.isMyLock} isPending={controller.isPending} setPayload={controller.setPayload} setAttachmentsByField={controller.setAttachments} setName={controller.setName} setDescription={controller.setDescription} onSubmit={controller.save} onCancel={controller.cancelEditing} onDelete={() => controller.setDeleteOpen(true)} />
  </PageShell>;
}

function Feedback({ tone, label, message }: { tone: 'rose' | 'emerald' | 'amber'; label: string; message: string }) { const classes = { rose: 'bg-rose-500/10 border-rose-500/20 text-rose-300', emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300', amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300' }; return <div className={`p-4 rounded-xl border text-xs ${classes[tone]}`}><strong>{label}:</strong> {message}</div>; }
