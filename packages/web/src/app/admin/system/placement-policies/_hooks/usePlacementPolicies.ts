'use client';

import { useCallback, useEffect, useState, useTransition, type FormEvent } from 'react';
import type { ApiErrorResponse, PlacementPolicyListItemDto, PolicyMode } from '@dashboard/core';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { useUnsavedChanges } from '../../../../navigation/NavigationBlocker';
import { areFormValuesEqual } from '../../../../navigation/unsavedChanges';

export type PlacementPolicyForm = { policyKey: string; name: string; description: string; policyMode: PolicyMode };
const EMPTY_FORM: PlacementPolicyForm = { policyKey: '', name: '', description: '', policyMode: 'allow_all' };

export function usePlacementPolicies() {
  const [policies, setPolicies] = useState<PlacementPolicyListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<PlacementPolicyListItemDto | null>(null);
  const [policyToDelete, setPolicyToDelete] = useState<PlacementPolicyListItemDto | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<PlacementPolicyForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const baselineForm = editingPolicy
    ? { policyKey: editingPolicy.policyKey, name: editingPolicy.name, description: editingPolicy.description, policyMode: editingPolicy.policyMode }
    : EMPTY_FORM;
  const navigationGuard = useUnsavedChanges(isEditorOpen && !areFormValuesEqual(form, baselineForm));

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await AppCache.admin.listPlacementPolicies();
    if (result.success && result.data) setPolicies(result.data);
    else if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPolicies(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPolicies]);

  const openCreate = useCallback(() => {
    setEditingPolicy(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((policy: PlacementPolicyListItemDto) => {
    setEditingPolicy(policy);
    setForm({ policyKey: policy.policyKey, name: policy.name, description: policy.description, policyMode: policy.policyMode });
    setFormError(null);
    setEditorOpen(true);
  }, []);

  const submit = useCallback((event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = editingPolicy
        ? await AppCache.admin.updatePlacementPolicy({ ...form, policyKey: editingPolicy.policyKey, expectedRowVersion: editingPolicy.rowVersion })
        : await AppCache.admin.createPlacementPolicy(form);
      if (result.success) {
        setEditorOpen(false);
        await loadPolicies();
      } else if (result.error) setFormError(result.error);
    });
  }, [editingPolicy, form, loadPolicies]);

  const confirmDelete = useCallback(() => {
    if (!policyToDelete) return;
    const policy = policyToDelete;
    setPolicyToDelete(null);
    setError(null);
    startTransition(async () => {
      const result = await AppCache.admin.deletePlacementPolicy({
        policyKey: policy.policyKey,
        expectedRowVersion: policy.rowVersion,
      });
      if (result.success) await loadPolicies();
      else if (result.error) setError(result.error);
    });
  }, [loadPolicies, policyToDelete]);

  const closeEditor = useCallback(() => {
    if (!navigationGuard.confirmDiscard()) return;
    setEditorOpen(false);
  }, [navigationGuard]);

  return { policies, loading, error, editingPolicy, policyToDelete, setPolicyToDelete, isEditorOpen, form, setForm, formError, isPending, openCreate, openEdit, closeEditor, submit, confirmDelete };
}
