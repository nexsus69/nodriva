'use client';

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition, type FormEvent } from 'react';
import type { ApiErrorResponse, CreateTypeUiCommand, TypeKind, TypeListItemDto } from '@dashboard/core';
import { AppCache } from '../../../cache/GlobalCacheClient';
import { useUnsavedChanges } from '../../../navigation/NavigationBlocker';
import { areFormValuesEqual } from '../../../navigation/unsavedChanges';

export type TypeCreateForm = {
  typeKey: string;
  name: string;
  description: string;
  storageTable: string;
};

const EMPTY_FORM: TypeCreateForm = { typeKey: '', name: '', description: '', storageTable: '' };

export function useAdminTypes() {
  const [kind, setKind] = useState<TypeKind>('node');
  const [types, setTypes] = useState<TypeListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TypeCreateForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const navigationGuard = useUnsavedChanges(isCreateOpen && !areFormValuesEqual(form, EMPTY_FORM));
  const cacheRevision = useSyncExternalStore(AppCache.subscribe, AppCache.getRevision, () => 0);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await AppCache.admin.listTypes(kind);
    if (result.success && result.data) setTypes(result.data);
    else if (result.error) setError(result.error);
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTypes(), 0);
    return () => window.clearTimeout(timer);
  }, [cacheRevision, loadTypes]);

  const openCreate = useCallback(() => {
    setFormError(null);
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    if (!navigationGuard.confirmDiscard()) return;
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreateOpen(false);
  }, [navigationGuard]);

  const submitCreate = useCallback((event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const command: CreateTypeUiCommand = {
      kind,
      typeKey: form.typeKey.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      storageTable: kind === 'entity' ? form.storageTable.trim() || undefined : undefined,
    };
    startTransition(async () => {
      const result = await AppCache.admin.createType(command);
      if (result.success) {
        setCreateOpen(false);
        setForm(EMPTY_FORM);
        await loadTypes();
      } else if (result.error) setFormError(result.error);
    });
  }, [form, kind, loadTypes]);

  return {
    kind,
    setKind,
    types,
    loading,
    error,
    isCreateOpen,
    openCreate,
    closeCreate,
    form,
    setForm,
    formError,
    isPending,
    loadTypes,
    submitCreate,
  };
}
