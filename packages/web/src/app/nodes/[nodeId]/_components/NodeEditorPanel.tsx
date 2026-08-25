/** Renders the node overview and its shared metadata-driven edit form. */
import { LockBadge } from '../../../components/LockBadge';
import { Panel, SectionHeader } from '../../../components/ui/layout';
import { NodeResourceMenu } from '../../../components/ui/menu';
import {
  AttachmentList,
  applyResourceFormDraftChange,
  buildResourceIdentityFields,
  flattenResourceFormDraft,
  ResourceFormRenderer,
} from '../../../components/ui/forms';
import { Skeleton } from '../../../components/ui/feedback';
import type { useNodeDetail } from '../_hooks/useNodeDetail';

interface NodeEditorPanelProps {
  nodeId: string;
  controller: ReturnType<typeof useNodeDetail>;
}

/** Presents node identity, lock state, dynamic draft fields, and owned attachments. */
export function NodeEditorPanel({ nodeId, controller }: NodeEditorPanelProps) {
  const attachmentFields = controller.dynamicNodeFields.filter((field) => (
    ['file', 'image'].includes(field.dataType.toLowerCase())
  ));
  const attachmentKeys = new Set(
    attachmentFields.map((field) => field.fieldKey),
  );
  const dynamicFieldNames = controller.dynamicNodeFields.map((field) => field.fieldKey);
  const formValues = flattenResourceFormDraft({
    name: controller.nodeName,
    description: controller.nodeDescription,
    payload: controller.dynamicNodePayload,
    attachments: controller.attachmentsByField,
  });

  return (
    <>
      <Panel className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-xl text-indigo-600">
              📦
            </div>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                {controller.isNodeLoading || !controller.currentNode ? (
                  <span role="status" aria-label="Caricamento nodo">
                    <Skeleton className="h-6 w-48" />
                  </span>
                ) : (
                  <span className="min-w-0 break-words">
                    {controller.currentNode.name}
                  </span>
                )}
                {controller.currentNode && (
                  <NodeResourceMenu
                    nodeId={controller.currentNode.id}
                    nodeName={controller.currentNode.name}
                    onEdit={() => { void controller.beginNodeEditing(); }}
                  />
                )}
              </h1>
              {controller.isNodeLoading || !controller.currentNode ? (
                <Skeleton className="mt-1 h-3 w-36" />
              ) : (
                <p className="mt-0.5 text-xs font-mono text-slate-400">
                  Path: {controller.currentNode.pathLabel || controller.currentNode.path || '-'}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-mono uppercase text-slate-500">
              Version {controller.currentNode?.rowVersion || 1}
            </span>
            <LockBadge
              lockedByOther={controller.lockedByOther}
              isMyLock={controller.isMyLock}
              acquireLock={controller.beginNodeEditing}
              releaseLock={controller.exitEditMode}
              error={controller.lockError}
            />
          </div>
        </div>
        {controller.isMyLock ? (
          <ResourceFormRenderer
            baseFields={buildResourceIdentityFields({
              nameLabel: 'Nome nodo',
              descriptionLabel: 'Descrizione',
            })}
            fields={controller.dynamicNodeFields}
            values={formValues}
            onChange={(fieldName, value) => applyResourceFormDraftChange(
              fieldName,
              value,
              {
                attachmentFieldKeys: attachmentKeys,
                onNameChange: controller.setNodeName,
                onDescriptionChange: controller.setNodeDescription,
                onPayloadChange: (fieldKey, nextValue) => controller.setDynamicNodePayload(
                  (current) => ({ ...current, [fieldKey]: nextValue }),
                ),
                onAttachmentsChange: (fieldKey, files) => controller.setAttachmentsByField(
                  (current) => ({ ...current, [fieldKey]: files }),
                ),
              },
            )}
            onSubmit={controller.handleUpdateNode}
            onCancel={() => { void controller.exitEditMode(); }}
            isPending={controller.isSavingNode}
            submitDisabled={!controller.nodeName.trim()}
            submitLabel="Salva modifiche"
            pendingLabel="Salvataggio…"
            cancelLabel="Annulla"
            theme="light"
            definition={{
              key: 'edit-node',
              version: '1',
              layout: { columns: 2, gap: 'normal' },
              sections: [
                {
                  key: 'identity',
                  label: 'Informazioni principali',
                  fieldNames: ['name', 'description'],
                  columns: 2,
                },
                {
                  key: 'fields',
                  label: 'Campi del tipo',
                  fieldNames: dynamicFieldNames,
                  columns: 2,
                },
              ],
            }}
          />
        ) : controller.currentNode?.description ? (
          <p className="border-t border-slate-200 pt-3 text-sm text-slate-500">
            {controller.currentNode.description}
          </p>
        ) : null}
      </Panel>

      {attachmentFields.map((field) => (
        <Panel key={field.fieldKey} className="space-y-3">
          <SectionHeader
            title={field.label ?? field.fieldKey}
            description={
              field.dataType.toLowerCase() === 'image'
                ? 'Immagini collegate al campo.'
                : 'Documenti collegati al campo.'
            }
          />
          <AttachmentList
            resourceType="node"
            resourceId={nodeId}
            fieldKey={field.fieldKey}
            kind={field.dataType.toLowerCase() as 'file' | 'image'}
            tone="light"
            canDelete={controller.isMyLock}
          />
        </Panel>
      ))}
    </>
  );
}
