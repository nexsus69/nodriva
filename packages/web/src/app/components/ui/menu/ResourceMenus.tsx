'use client';

import { useRouter } from 'next/navigation';
import { OverflowMenu } from './Menu';
import { useNavigationRequest } from '../../../navigation/NavigationBlocker';
import { useNavigationHref } from '../../../navigation/returnContext';

function copyTechnicalId(id: string): void {
  void navigator.clipboard?.writeText(id);
}

export interface NodeResourceMenuProps {
  nodeId: string;
  nodeName: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** Canonical operations for every node representation in the workspace. */
export function NodeResourceMenu({ nodeId, nodeName, onEdit, onDelete }: NodeResourceMenuProps) {
  const router = useRouter();
  const requestNavigation = useNavigationRequest();
  const nodeHref = useNavigationHref(`/nodes/${nodeId}`);
  const createChildHref = useNavigationHref(`/nodes/${nodeId}/new`);
  const createEntityHref = useNavigationHref(`/nodes/${nodeId}/entities/new`);
  const navigate = (href: string) => {
    void requestNavigation(() => router.push(href));
  };

  return (
    <OverflowMenu
      label={`Azioni per ${nodeName}`}
      items={[
        { id: 'open', label: 'Apri nodo', onSelect: () => navigate(nodeHref) },
        { id: 'edit', label: 'Modifica nodo', onSelect: onEdit ?? (() => navigate(nodeHref)) },
        { id: 'new-child', label: 'Nuovo sotto-nodo', onSelect: () => navigate(createChildHref) },
        { id: 'new-entity', label: 'Nuova entità', onSelect: () => navigate(createEntityHref) },
        { id: 'copy-id', label: 'Copia ID tecnico', onSelect: () => copyTechnicalId(nodeId) },
        ...(onDelete ? [{ id: 'delete', label: 'Elimina nodo', destructive: true, onSelect: onDelete }] : []),
      ]}
    />
  );
}

export interface EntityResourceMenuProps {
  entityId: string;
  entityName: string;
  parentNodeId: string;
  onEdit?: () => void;
  onDelete?: () => void;
  editDisabled?: boolean;
}

/** Canonical operations for every entity representation in the workspace. */
export function EntityResourceMenu({ entityId, entityName, parentNodeId, onEdit, onDelete, editDisabled = false }: EntityResourceMenuProps) {
  const router = useRouter();
  const requestNavigation = useNavigationRequest();
  const entityHref = useNavigationHref(`/nodes/${parentNodeId}/entities/${entityId}`);
  const navigate = (href: string) => {
    void requestNavigation(() => router.push(href));
  };

  return (
    <OverflowMenu
      label={`Azioni per ${entityName}`}
      items={[
        { id: 'open', label: 'Apri entità', onSelect: () => navigate(entityHref) },
        { id: 'edit', label: editDisabled ? 'In modifica' : 'Modifica entità', disabled: editDisabled, onSelect: onEdit ?? (() => navigate(entityHref)) },
        { id: 'copy-id', label: 'Copia ID tecnico', onSelect: () => copyTechnicalId(entityId) },
        ...(onDelete ? [{ id: 'delete', label: 'Elimina entità', destructive: true, onSelect: onDelete }] : []),
      ]}
    />
  );
}
