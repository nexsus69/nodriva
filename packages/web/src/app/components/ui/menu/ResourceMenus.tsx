'use client';

import { useRouter } from 'next/navigation';
import { OverflowMenu } from './Menu';
import { useNavigationRequest } from '../../../navigation/NavigationBlocker';

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
  const requestNavigation = useNavigationRequest();
  const navigate = (href: string) => {
    void requestNavigation(() => router.push(href));
  };

  return (
    <OverflowMenu
      label={`Azioni per ${nodeName}`}
      items={[
        { id: 'open', label: 'Apri nodo', onSelect: () => navigate(`/nodes/${nodeId}`) },
        { id: 'edit', label: 'Modifica nodo', onSelect: onEdit ?? (() => navigate(`/nodes/${nodeId}`)) },
        { id: 'new-child', label: 'Nuovo sotto-nodo', onSelect: () => navigate(`/nodes/${nodeId}/new`) },
        { id: 'new-entity', label: 'Nuova entità', onSelect: () => navigate(`/nodes/${nodeId}/entities/new`) },
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
  const requestNavigation = useNavigationRequest();
  const navigate = (href: string) => {
    void requestNavigation(() => router.push(href));
  };

  return (
    <OverflowMenu
      label={`Azioni per ${entityName}`}
      items={[
        { id: 'open', label: 'Apri entità', onSelect: () => navigate(`/nodes/${parentNodeId}/entities/${entityId}`) },
        { id: 'edit', label: editDisabled ? 'In modifica' : 'Modifica entità', disabled: editDisabled, onSelect: onEdit ?? (() => navigate(`/nodes/${parentNodeId}/entities/${entityId}`)) },
        { id: 'copy-id', label: 'Copia ID tecnico', onSelect: () => copyTechnicalId(entityId) },
      ]}
    />
  );
}
