'use client';

import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import type { ApiErrorResponse, CreateUserUiCommand, ScopeAssignmentDto, UserListItemDto } from '@dashboard/core';
import { AppCache } from '../../../cache/GlobalCacheClient';

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
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await AppCache.users.listUsers());
    } catch (reason) {
      setError(reason as ApiErrorResponse);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const openCreate = useCallback(() => {
    setFormError(null);
    setSelectedScopeIds([]);
    setCreateOpen(true);
    void AppCache.admin.listScopeAssignments()
      .then((result) => setDelegableScopes(result.success && result.data
        ? result.data.filter((scope) => scope.assignmentEffect === 'allow')
        : []))
      .catch(() => setDelegableScopes([]));
  }, []);

  const closeCreate = useCallback(() => setCreateOpen(false), []);

  const submitCreate = useCallback((event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
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
        setFormError(reason as ApiErrorResponse);
      }
    });
  }, [delegableScopes, form, loadUsers, selectedScopeIds]);

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
    selectedScopeIds,
    setSelectedScopeIds,
    formError,
    isPending,
    submitCreate,
  };
}
