'use client';

import { useCallback, useEffect, useState, useTransition, type FormEvent } from 'react';
import type { ApiErrorResponse, RoleListItemDto } from '@dashboard/core';
import { AppCache } from '../../../../cache/GlobalCacheClient';

export type RoleCreateForm = { roleKey: string; name: string; description: string };
const EMPTY_FORM: RoleCreateForm = { roleKey: '', name: '', description: '' };

export function useSecurityRoles() {
  const [roles, setRoles] = useState<RoleListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<RoleCreateForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadRoles = useCallback(async () => {
    setLoading(true); setError(null);
    const result = await AppCache.admin.listRoles();
    if (result.success && result.data) setRoles(result.data);
    else if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadRoles(), 0); return () => window.clearTimeout(timer); }, [loadRoles]);

  const openCreate = useCallback(() => { setFormError(null); setCreateOpen(true); }, []);
  const submitCreate = useCallback((event: FormEvent) => {
    event.preventDefault(); setFormError(null);
    startTransition(async () => {
      const result = await AppCache.admin.createRole({ roleKey: form.roleKey.trim(), name: form.name.trim(), description: form.description.trim() || undefined });
      if (result.success) { setCreateOpen(false); setForm(EMPTY_FORM); await loadRoles(); }
      else if (result.error) setFormError(result.error);
    });
  }, [form, loadRoles]);

  return { roles, loading, error, isCreateOpen, setCreateOpen, form, setForm, formError, isPending, openCreate, submitCreate };
}
