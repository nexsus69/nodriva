'use client';

import Link from '@/app/components/navigation/GuardedLink';
import type { TypeKind } from '@dashboard/core';
import { AdminResourceLock } from '../../../../_components/AdminResourceLock';
import { NodeTypeEncryptionPolicy } from '../../../_components/NodeTypeEncryptionPolicy';
import { TypeDetailDialogs } from './TypeDetailDialogs';
import { TypeDetailHeader } from './TypeDetailHeader';
import { TypeDetailOverview } from './TypeDetailOverview';
import { TypeFieldsSection } from './TypeFieldsSection';
import { TypeSchemaGovernance } from './TypeSchemaGovernance';
import { useAdminTypeDetail } from '../_hooks/useAdminTypeDetail';

export function AdminTypeDetailScreen({ kind, typeKey }: { kind: TypeKind; typeKey: string }) {
  const controller = useAdminTypeDetail(kind, typeKey);
  if (controller.loading) return <div className="min-h-screen px-4 py-6 sm:p-10 max-w-5xl mx-auto text-center text-slate-400"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /><p>Caricamento dettaglio tipo...</p></div>;
  if (!controller.typeDetail) return <div className="min-h-screen px-4 py-6 sm:p-10 max-w-3xl mx-auto space-y-4"><div className="p-5 bg-red-950/50 border border-red-500/40 rounded-2xl text-red-200"><h2 className="text-lg font-bold">Errore di Caricamento</h2><p className="text-sm mt-1">{controller.error?.message ?? 'Tipo non trovato.'}</p></div><Link href="/admin/types" className="text-indigo-400 text-sm">← Torna alla lista tipi</Link></div>;
  const detail = controller.typeDetail;
  return <div className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto space-y-8">
    <AdminResourceLock resourceType={kind === 'node' ? 'node_type' : 'entity_type'} resourceId={detail.id} />
    <TypeDetailDialogs controller={controller} />
    <TypeDetailHeader detail={detail} isPending={controller.isPending} error={controller.error} conflictError={controller.conflictError} successMessage={controller.successMessage} onReload={() => void controller.loadData()} onToggleActive={() => void controller.handleDisableType()} onDismissSuccess={() => controller.setSuccessMessage(null)} />
    <TypeDetailOverview detail={detail} name={controller.typeName} description={controller.typeDescription} isPending={controller.isPending} setName={controller.setTypeName} setDescription={controller.setTypeDescription} onSubmit={controller.handleUpdateType} />
    {kind === 'node' && <NodeTypeEncryptionPolicy nodeTypeId={detail.id} />}
    <TypeSchemaGovernance detail={detail} schemaHistory={controller.schemaHistory} schemaImpact={controller.schemaImpact} onPrepareRollback={(auditId) => void controller.prepareRollback(auditId)} />
    <TypeFieldsSection fields={detail.fields} isEditable={detail.isEditable} isPending={controller.isPending} onAdd={controller.openAddFieldModal} onMove={controller.handleMoveField} onEdit={controller.openEditFieldModal} onDelete={(fieldId, label) => void controller.handleDeleteField(fieldId, label)} />
  </div>;
}
