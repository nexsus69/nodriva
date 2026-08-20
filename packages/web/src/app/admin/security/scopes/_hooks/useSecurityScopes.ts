'use client';

import { useCallback, useEffect, useState, useTransition, type FormEvent } from 'react';
import type { ApiErrorResponse, RoleListItemDto, ScopeAssignmentDto, UserListItemDto } from '@dashboard/core';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { useUnsavedChanges } from '../../../../navigation/NavigationBlocker';
import { toClientErrorResponse } from '../../../../errors/clientError';

type AssignmentEffect = 'allow' | 'deny';
type Propagation = 'self' | 'subtree';

export function useSecurityScopes() {
  const [scopes, setScopes] = useState<ScopeAssignmentDto[]>([]);
  const [users, setUsers] = useState<UserListItemDto[]>([]);
  const [roles, setRoles] = useState<RoleListItemDto[]>([]);
  const [nodes, setNodes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<ScopeAssignmentDto | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [assignmentEffect, setAssignmentEffect] = useState<AssignmentEffect>('allow');
  const [propagation, setPropagation] = useState<Propagation>('subtree');
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const scopeDirty = isModalOpen && (editingScope
    ? selectedUserId !== editingScope.userId || selectedNodeId !== editingScope.nodeId
      || selectedRoleId !== editingScope.roleId || assignmentEffect !== editingScope.assignmentEffect
      || propagation !== editingScope.propagation
    : selectedUserId !== '' || selectedNodeId !== '' || selectedRoleId !== ''
      || assignmentEffect !== 'allow' || propagation !== 'subtree');
  const navigationGuard = useUnsavedChanges(scopeDirty);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scopeResult, loadedUsers, roleResult] = await Promise.all([
        AppCache.admin.listScopeAssignments(),
        AppCache.users.listUsers(),
        AppCache.admin.listRoles(),
      ]);
      const loadedNodes: { id: string; name: string }[] = [];
      const visit = async (parentId: string | null): Promise<void> => {
        for (const node of await AppCache.admin.listChildren(parentId)) {
          loadedNodes.push({ id: node.id, name: node.name });
          await visit(node.id);
        }
      };
      await visit(null);
      if (scopeResult.success && scopeResult.data) setScopes(scopeResult.data);
      else if (scopeResult.error) setError(scopeResult.error);
      setUsers(loadedUsers);
      if (roleResult.success && roleResult.data) setRoles(roleResult.data);
      else if (roleResult.error) setError(roleResult.error);
      setNodes(loadedNodes);
    } catch (reason) {
      setError(toClientErrorResponse(reason, 'Impossibile caricare gli ambiti di sicurezza.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const openCreate = useCallback(() => {
    setEditingScope(null);
    setSelectedUserId(''); setSelectedNodeId(''); setSelectedRoleId('');
    setAssignmentEffect('allow'); setPropagation('subtree'); setFormError(null); setModalOpen(true);
  }, []);

  const openEdit = useCallback((scope: ScopeAssignmentDto) => {
    setEditingScope(scope);
    setSelectedUserId(scope.userId); setSelectedNodeId(scope.nodeId); setSelectedRoleId(scope.roleId);
    setAssignmentEffect(scope.assignmentEffect); setPropagation(scope.propagation); setFormError(null); setModalOpen(true);
  }, []);

  const submit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = editingScope
        ? await AppCache.admin.updateScopeAssignment({ assignmentId: editingScope.id, roleId: selectedRoleId, assignmentEffect, propagation })
        : await AppCache.admin.createScopeAssignment({ userId: selectedUserId, nodeId: selectedNodeId, roleId: selectedRoleId, assignmentEffect, propagation });
      if (result.success) { setModalOpen(false); await loadData(); }
      else if (result.error) setFormError(result.error);
    });
  }, [assignmentEffect, editingScope, loadData, propagation, selectedNodeId, selectedRoleId, selectedUserId]);

  const remove = useCallback((assignmentId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await AppCache.admin.deleteScopeAssignment({ assignmentId });
      if (result.success) await loadData();
      else if (result.error) setError(result.error);
    });
  }, [loadData]);

  const closeModal = useCallback(() => {
    if (!navigationGuard.confirmDiscard()) return;
    setModalOpen(false);
  }, [navigationGuard]);

  return { scopes, users, roles, nodes, loading, error, isModalOpen, editingScope, selectedUserId, setSelectedUserId, selectedNodeId, setSelectedNodeId, selectedRoleId, setSelectedRoleId, assignmentEffect, setAssignmentEffect, propagation, setPropagation, formError, isPending, openCreate, openEdit, closeModal, submit, remove };
}
