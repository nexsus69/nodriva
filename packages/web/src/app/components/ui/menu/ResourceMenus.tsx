'use client';

import { useRouter } from 'next/navigation';
import { OverflowMenu } from './Menu';

function copyTechnicalId(id: string): void {
  void navigator.clipboard?.writeText(id);
}

export interface NodeResourceMenuProps {
  nodeId: string;
  nodeName: string;
  onEdit?: () => void;
}

/** Canonical operations for every node representation in the workspace. */
export function NodeResourceMenu({ nodeId, nodeName, onEdit }: NodeResourceMenuProps) {
  const router = useRouter();

  return (
    <OverflowMenu
      label={`Azioni per ${nodeName}`}
      items={[
        { id: 'open', label: 'Apri nodo', onSelect: () => router.push(`/nodes/${nodeId}`) },
        { id: 'edit', label: 'Modifica nodo', onSelect: onEdit ?? (() => router.push(`/nodes/${nodeId}`)) },
        { id: 'new-child', label: 'Nuovo sotto-nodo', onSelect: () => router.push(`/nodes/${nodeId}/new`) },
        { id: 'new-entity', label: 'Nuova entità', onSelect: () => router.push(`/nodes/${nodeId}/entities/new`) },
        { id: 'copy-id', label: 'Copia ID tecnico', onSelect: () => copyTechnicalId(nodeId) },
      ]}
    />
  );
}

export interface EntityResourceMenuProps {
  entityId: string;
  entityName: string;
  parentNodeId: string;
  onEdit?: () => void;
  editDisabled?: boolean;
}

/** Canonical operations for every entity representation in the workspace. */
export function EntityResourceMenu({ entityId, entityName, parentNodeId, onEdit, editDisabled = false }: EntityResourceMenuProps) {
  const router = useRouter();

  return (
    <OverflowMenu
      label={`Azioni per ${entityName}`}
      items={[
        { id: 'open', label: 'Apri entità', onSelect: () => router.push(`/nodes/${parentNodeId}/entities/${entityId}`) },
        { id: 'edit', label: editDisabled ? 'In modifica' : 'Modifica entità', disabled: editDisabled, onSelect: onEdit ?? (() => router.push(`/nodes/${parentNodeId}/entities/${entityId}`)) },
        { id: 'copy-id', label: 'Copia ID tecnico', onSelect: () => copyTechnicalId(entityId) },
      ]}
    />
  );
}
