'use client';

import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import type { ApiErrorResponse, CreateUserUiCommand, ScopeAssignmentDto, UserListItemDto } from '@dashboard/core';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { useUnsavedChanges } from '../../../navigation/NavigationBlocker';
import { areFormValuesEqual } from '../../../navigation/unsavedChanges';
import { toClientErrorResponse } from '../../../errors/clientError';
import { classifyDelegableScopeResult, type DelegableScopeLoadState } from './delegableScopeLoad';

type UserStatusFilter = 'all' | 'active' | 'disabled';

const EMPTY_FORM = { email: '', password: '', isSuperAdmin: false };

export function useUserAdminList() {
  const [users, setUsers] = useState<UserListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [filterStatus, setFilterStatus] = useState<UserStatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [delegableScopes, setDelegableScopes] = useState<ScopeAssignmentDto[]>([]);
  const [delegableScopeLoadState, setDelegableScopeLoadState] = useState<DelegableScopeLoadState>('idle');
  const [delegableScopeError, setDelegableScopeError] = useState<ApiErrorResponse | null>(null);
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const navigationGuard = useUnsavedChanges(isCreateOpen && (
    !areFormValuesEqual(form, EMPTY_FORM) || selectedScopeIds.length > 0
  ));

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await AppCache.users.listUsers());
    } catch (reason) {
      setError(toClientErrorResponse(reason, 'Impossibile caricare gli utenti.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const loadDelegableScopes = useCallback(async () => {
    setDelegableScopeLoadState('loading');
    setDelegableScopeError(null);
    try {
      const resolved = classifyDelegableScopeResult(await AppCache.admin.listScopeAssignments());
      setDelegableScopes(resolved.scopes);
      setDelegableScopeLoadState(resolved.state);
      setDelegableScopeError(resolved.error);
    } catch (reason) {
      setDelegableScopes([]);
      setDelegableScopeLoadState('failed');
      setDelegableScopeError(toClientErrorResponse(reason, 'Impossibile verificare gli ambiti delegabili.'));
    }
  }, []);

  const openCreate = useCallback(() => {
    setFormError(null);
    setSelectedScopeIds([]);
    setCreateOpen(true);
    void loadDelegableScopes();
  }, [loadDelegableScopes]);

  const closeCreate = useCallback(() => {
    if (!navigationGuard.confirmDiscard()) return;
    setForm(EMPTY_FORM);
    setSelectedScopeIds([]);
    setFormError(null);
    setDelegableScopeError(null);
    setDelegableScopeLoadState('idle');
    setCreateOpen(false);
  }, [navigationGuard]);

  const submitCreate = useCallback((event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (delegableScopeLoadState === 'idle' || delegableScopeLoadState === 'loading' || delegableScopeLoadState === 'failed') {
      setFormError(delegableScopeError ?? { code: 'INTERNAL_ERROR', message: 'Attendi la verifica degli ambiti delegabili.' });
      return;
    }
    startTransition(async () => {
      try {
        const assignments = delegableScopes
          .filter((scope) => selectedScopeIds.includes(scope.id) && scope.assignmentEffect === 'allow')
          .map((scope) => ({ nodeId: scope.nodeId, roleId: scope.roleId, propagation: scope.propagation }));
        if (assignments.length > 0) {
          await AppCache.users.createScopedUser({ email: form.email.trim(), password: form.password, assignments });
        } else {
          const command: CreateUserUiCommand = {
            email: form.email.trim(),
            password: form.password,
            isSuperAdmin: form.isSuperAdmin,
          };
          await AppCache.users.createUser(command);
        }
        setCreateOpen(false);
        setForm(EMPTY_FORM);
        setSelectedScopeIds([]);
        await loadUsers();
      } catch (reason) {
        setFormError(toClientErrorResponse(reason, 'Impossibile creare l’utente.'));
      }
    });
  }, [delegableScopeError, delegableScopeLoadState, delegableScopes, form, loadUsers, selectedScopeIds]);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const matchesStatus = filterStatus === 'all'
      || (filterStatus === 'active' ? user.isActive : !user.isActive);
    return matchesStatus && user.email.toLowerCase().includes(searchTerm.toLowerCase());
  }), [filterStatus, searchTerm, users]);

  return {
    users,
    filteredUsers,
    loading,
    error,
    filterStatus,
    setFilterStatus,
    searchTerm,
    setSearchTerm,
    isCreateOpen,
    openCreate,
    closeCreate,
    form,
    setForm,
    delegableScopes,
    delegableScopeLoadState,
    delegableScopeError,
    reloadDelegableScopes: loadDelegableScopes,
    selectedScopeIds,
    setSelectedScopeIds,
    formError,
    isPending,
    submitCreate,
  };
}
