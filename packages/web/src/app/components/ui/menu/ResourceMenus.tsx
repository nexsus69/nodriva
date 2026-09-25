'use client';

import { useRouter } from 'next/navigation';
import { OverflowMenu } from './Menu';
import { useNavigationRequest } from '../../../navigation/NavigationBlocker';
import { useNavigationHref } from '../../../navigation/returnContext';
import { useResourceMenuDelete } from './useResourceMenuDelete';
import { ResourceDeleteRestriction } from '../feedback';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

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
  const menuDelete = useResourceMenuDelete({ kind: 'node', resourceId: nodeId });
  const { t } = useAppLocale();
  const navigate = (href: string) => {
    void requestNavigation(() => router.push(href));
  };

  return (
    <span className="relative inline-flex">
      <OverflowMenu
        label={`${t('menu.actionsFor')} ${nodeName}`}
        items={[
          { id: 'open', label: t('menu.openNode'), onSelect: () => navigate(nodeHref) }, { id: 'edit', label: t('menu.editNode'), onSelect: onEdit ?? (() => navigate(nodeHref)) }, { id: 'new-child', label: t('menu.newChild'), onSelect: () => navigate(createChildHref) }, { id: 'new-entity', label: t('menu.newEntity'), onSelect: () => navigate(createEntityHref) }, { id: 'copy-id', label: t('menu.copyTechnicalId'), onSelect: () => copyTechnicalId(nodeId) }, { id: 'delete', label: menuDelete.isDeleting ? t('attachments.deleting') : t('menu.deleteNode'), destructive: true, disabled: menuDelete.isDeleting, onSelect: onDelete ?? menuDelete.requestDelete },
        ]}
      />
      {menuDelete.errorMessage && <span role="alert" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-lg">{menuDelete.errorMessage}{menuDelete.canRetry && <button type="button" className="ml-2 font-semibold underline" onClick={menuDelete.retryDelete}>{t('common.retry')}</button>}{menuDelete.deleteRestriction && <ResourceDeleteRestriction restriction={menuDelete.deleteRestriction} />}</span>}
    </span>
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
  const menuDelete = useResourceMenuDelete({ kind: 'entity', resourceId: entityId, parentNodeId });
  const { t } = useAppLocale();
  const navigate = (href: string) => {
    void requestNavigation(() => router.push(href));
  };

  return (
    <span className="relative inline-flex">
      <OverflowMenu
        label={`${t('menu.actionsFor')} ${entityName}`}
        items={[
          { id: 'open', label: t('menu.openEntity'), onSelect: () => navigate(entityHref) }, { id: 'edit', label: editDisabled ? t('menu.editing') : t('menu.editEntity'), disabled: editDisabled, onSelect: onEdit ?? (() => navigate(entityHref)) }, { id: 'copy-id', label: t('menu.copyTechnicalId'), onSelect: () => copyTechnicalId(entityId) }, { id: 'delete', label: menuDelete.isDeleting ? t('attachments.deleting') : t('menu.deleteEntity'), destructive: true, disabled: menuDelete.isDeleting, onSelect: onDelete ?? menuDelete.requestDelete },
        ]}
      />
      {menuDelete.errorMessage && <span role="alert" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-lg">{menuDelete.errorMessage}{menuDelete.canRetry && <button type="button" className="ml-2 font-semibold underline" onClick={menuDelete.retryDelete}>{t('common.retry')}</button>}{menuDelete.deleteRestriction && <ResourceDeleteRestriction restriction={menuDelete.deleteRestriction} />}</span>}
    </span>
  );
}
