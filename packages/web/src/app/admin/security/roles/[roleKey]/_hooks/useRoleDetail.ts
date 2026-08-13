'use client';

import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import type { ApiErrorResponse, RoleDetailDto } from '@dashboard/core';
import { AppCache } from '../../../../../cache/GlobalCacheClient';

export function useRoleDetail(roleKey: string) {
  const [role, setRole] = useState<RoleDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!roleKey) return;
    let cancelled = false;
    void AppCache.admin.getRoleByKey(roleKey).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) { setRole(result.data); setSelectedPermissionIds(result.data.permissions.map((permission) => permission.id)); }
      else if (result.error) setError(result.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [roleKey]);

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, RoleDetailDto['allAvailablePermissions']> = {};
    for (const permission of role?.allAvailablePermissions ?? []) (groups[permission.resourceKind || 'Generale'] ??= []).push(permission);
    return groups;
  }, [role]);

  const togglePermission = (permissionId: string) => {
    if (role?.isSystem) return;
    setSelectedPermissionIds((current) => current.includes(permissionId) ? current.filter((id) => id !== permissionId) : [...current, permissionId]);
  };

  const savePermissions = (event: FormEvent) => {
    event.preventDefault();
    if (!role || role.isSystem) return;
    setError(null); setSuccessMessage(null);
    startTransition(async () => {
      const result = await AppCache.admin.updateRolePermissions({ roleKey: role.roleKey, permissionIds: selectedPermissionIds, expectedRowVersion: role.rowVersion });
      if (result.success && result.data) { setRole(result.data); setSelectedPermissionIds(result.data.permissions.map((permission) => permission.id)); setSuccessMessage('Matrice permessi aggiornata con successo.'); }
      else if (result.error) setError(result.error);
    });
  };

  return { role, loading, error, successMessage, selectedPermissionIds, groupedPermissions, isPending, togglePermission, savePermissions };
}
