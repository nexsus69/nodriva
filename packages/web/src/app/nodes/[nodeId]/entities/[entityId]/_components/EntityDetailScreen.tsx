'use client';

/** Composes the interactive entity detail screen from shared resource surfaces. */

import { useParams } from 'next/navigation';
import Link from '@/app/components/navigation/GuardedLink';
import type { ReactNode } from 'react';
import { LockBadge } from '../../../../../components/LockBadge';
import { LockIndicator } from '../../../../../components/LockIndicator';
import { NodeBreadcrumb } from '../../../../../components/navigation/NodeBreadcrumb';
import { ResourceDeleteRestriction, Skeleton, SkeletonState } from '../../../../../components/ui/feedback';
import { PageShell, Panel } from '../../../../../components/ui/layout';
import { EntityResourceMenu } from '../../../../../components/ui/menu';
import { RelationPanel } from '../../../../../components/ui/relations';
import { EntityDetailContent } from './EntityDetailContent';
import { useEntityDetailController } from '../_hooks/useEntityDetailController';
import { useAppLocale } from '../../../../../i18n/AppLocaleStore';
import { EnumOptionModal, RelatedEntityModal } from '../../../../../components/ui/forms';
import { SITE_THEME } from '@/Theme';

export function EntityDetailScreen({ admin = false, entityId: suppliedEntityId, nodeId: suppliedNodeId }: { admin?: boolean; entityId?: string; nodeId?: string }) {
  const { t } = useAppLocale();
  const { nodeId, entityId } = useParams<{ nodeId: string; entityId: string }>();
  const resolvedNodeId = suppliedNodeId ?? nodeId;
  const resolvedEntityId = suppliedEntityId ?? entityId;
  const controller = useEntityDetailController(
    resolvedEntityId,
    resolvedNodeId,
    admin ? { afterDelete: '/admin/content/entities', detailPath: `/admin/content/entities/${resolvedNodeId}/${resolvedEntityId}` } : undefined,
  );
  if (controller.isLoading || !controller.entity) {
    return (
      <PageShell className="max-w-2xl">
        <div className="flex min-w-0 items-center gap-1">
          {admin ? <Link href="/admin/content/entities" className="text-xs font-semibold text-indigo-700">← {t('admin.entities')}</Link> : <NodeBreadcrumb nodeId={resolvedNodeId} currentNodeLinkable />}
          <span className="text-slate-400">/</span>
          <Skeleton className="h-3 w-20" />
        </div>
        {controller.isError ? (
          <Panel className="border-rose-200 bg-rose-50 text-xs text-rose-700">
            {t('common.error')}: {controller.error?.message}
          </Panel>
        ) : (
          <>
            <Panel>
              <SkeletonState
                label={t('entity.loadingHeader')}
                className="flex items-center gap-3"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </SkeletonState>
            </Panel>
            <Panel>
              <SkeletonState
                label={t('entity.loadingFields')}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                {[0, 1, 2, 3].map((field) => (
                  <div key={field} className="space-y-2">
                    <Skeleton className="h-2.5 w-20" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </SkeletonState>
            </Panel>
          </>
        )}
      </PageShell>
    );
  }

  const entity = controller.entity;
  return (
    <PageShell className="max-w-2xl">
      <div aria-label={admin ? t('admin.detailPath') : undefined} className="flex min-w-0 items-center gap-1">
        {admin ? <><Link href="/admin/content/entities" className="text-xs font-semibold text-indigo-700">← {t('admin.entities')}</Link><span className="text-xs font-semibold text-slate-500">{t('admin.detail')}</span></> : <NodeBreadcrumb nodeId={resolvedNodeId} currentNodeLinkable />}
        <span className="text-slate-400">/</span>
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-mono font-semibold text-slate-800">
          <span className="truncate">{entity.name}</span>
          <LockIndicator resourceType="entity" resourceId={entity.id} />
        </span>
      </div>
      <Panel className="flex flex-col gap-4 p-4 text-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <span className="block break-all text-[10px] font-mono uppercase text-indigo-600">
            {t('entity.id')}: {entity.id}
          </span>
          <h1 className="mt-1 flex items-center gap-1 text-xl font-bold">
            <span>{entity.name}</span>
            <EntityResourceMenu
              entityId={entity.id}
              entityName={entity.name}
              parentNodeId={resolvedNodeId}
              onEdit={() => void controller.beginEditing()}
              onDelete={() => { void controller.requestDelete(); }}
              editDisabled={controller.lock.isMyLock}
            />
          </h1>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            {t('common.type')}: {controller.entityType?.name ?? <Skeleton className="inline-block h-3 w-24" />}
            {' '}({t('common.version')}: {entity.rowVersion})
          </p>
        </div>
        <LockBadge
          lockedByOther={controller.lock.lockedByOther}
          isMyLock={controller.lock.isMyLock}
          acquireLock={controller.beginEditing}
          releaseLock={async () => {
            await controller.cancelEditing();
          }}
          error={controller.lock.error}
        />
      </Panel>
      {controller.errorMessage && (
        <Feedback tone="rose" label="Errore" message={controller.errorMessage} action={controller.formStale ? { label: 'Ricarica dati', onClick: () => void controller.reloadFresh() } : undefined}>
          {controller.deleteRestriction && <ResourceDeleteRestriction restriction={controller.deleteRestriction} />}
        </Feedback>
      )}
      {controller.lock.error && (
        <Feedback tone="amber" label="Lock" message={controller.lock.error} />
      )}
      <EntityDetailContent
        entity={entity}
        fields={controller.fields}
        entityTypes={controller.entityTypesList}
        payload={controller.payload}
        attachmentsByField={controller.attachments}
        name={controller.name}
        description={controller.description}
        isMyLock={controller.lock.isMyLock}
        isPending={controller.isPending}
        formStale={controller.formStale}
        attachmentVersion={controller.attachmentVersion}
        onAttachmentVersionChanged={controller.acceptAttachmentVersion}
        setPayload={controller.setPayload}
        setAttachmentsByField={controller.setAttachments}
        setName={controller.setName}
        setDescription={controller.setDescription}
        onSubmit={controller.save}
        onCancel={controller.cancelEditing}
        onDelete={() => {
          void controller.requestDelete();
        }}
        onAddEnumOption={controller.enumOption.open}
        onCreateRelatedEntity={controller.related.open}
      />
      {controller.related.field && (
        <RelatedEntityModal
          fields={controller.related.fields}
          payload={controller.related.payload}
          name={controller.related.name}
          description={controller.related.description}
          isDirty={controller.related.isDirty}
          isPending={controller.related.pending}
          setPayload={controller.related.setPayload}
          setName={controller.related.setName}
          setDescription={controller.related.setDescription}
          onClose={controller.related.close}
          onDiscard={controller.related.discard}
          onSubmit={controller.related.submit}
        />
      )}
      {controller.enumOption.field && (
        <EnumOptionModal
          open
          values={controller.enumOption.values}
          isDirty={controller.enumOption.isCurrentDirty}
          pending={controller.enumOption.pending}
          failure={controller.enumOption.failure}
          theme={SITE_THEME.form}
          onChange={controller.enumOption.change}
          onSubmit={(event) => { event.preventDefault(); void controller.enumOption.submit(); }}
          onRetry={controller.enumOption.retry}
          onClose={controller.enumOption.close}
          onDiscard={controller.enumOption.discard}
        />
      )}
      {controller.entityType?.typeKey && (
        <RelationPanel
          resourceDomain="entity"
          resourceTypeKey={controller.entityType.typeKey}
          resourceId={entity.id}
        />
      )}
    </PageShell>
  );
}

interface FeedbackProps {
  tone: 'rose' | 'emerald' | 'amber';
  label: string;
  message: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}

function Feedback({ tone, label, message, action, children }: FeedbackProps) {
  const classes = {
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };

  return (
    <div className={`rounded-xl border p-4 text-xs ${classes[tone]}`}>
      <strong>{label}:</strong> {message}
      {children}
      {action && <button type="button" className="ml-3 underline" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
