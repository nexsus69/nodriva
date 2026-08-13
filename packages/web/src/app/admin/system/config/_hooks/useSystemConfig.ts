'use client';

import { useCallback, useEffect, useState, useTransition, type FormEvent } from 'react';
import type { ApiErrorResponse, CapabilityStatus, RuntimeCapabilityDto, SystemSettingDto } from '@dashboard/core';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { useUnsavedChanges } from '../../../../navigation/NavigationBlocker';

export function useSystemConfig() {
  const [capabilities, setCapabilities] = useState<RuntimeCapabilityDto[]>([]);
  const [settings, setSettings] = useState<SystemSettingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [editingSetting, setEditingSetting] = useState<SystemSettingDto | null>(null);
  const [settingValue, setSettingValue] = useState('');
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const settingDirty = Boolean(editingSetting && settingValue !== (editingSetting.valueText ?? ''));
  const navigationGuard = useUnsavedChanges(settingDirty);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    const [capabilityResult, settingResult] = await Promise.all([AppCache.admin.listCapabilities(), AppCache.admin.listSettings()]);
    if (capabilityResult.success && capabilityResult.data) setCapabilities(capabilityResult.data);
    else if (capabilityResult.error) setError(capabilityResult.error);
    if (settingResult.success && settingResult.data) setSettings(settingResult.data);
    else if (settingResult.error) setError(settingResult.error);
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void loadData(), 0); return () => window.clearTimeout(timer); }, [loadData]);

  const updateCapability = useCallback((capabilityKey: string, status: CapabilityStatus) => {
    startTransition(async () => {
      const result = await AppCache.admin.updateCapabilityStatus({ capabilityKey, status });
      if (result.success) await loadData();
      else if (result.error) setError(result.error);
    });
  }, [loadData]);

  const openSetting = useCallback((setting: SystemSettingDto) => {
    setEditingSetting(setting); setSettingValue(setting.valueText ?? ''); setFormError(null);
  }, []);

  const saveSetting = useCallback((event: FormEvent) => {
    event.preventDefault();
    if (!editingSetting) return;
    setFormError(null);
    startTransition(async () => {
      const result = await AppCache.admin.updateSetting({ settingKey: editingSetting.settingKey, settingValueText: settingValue, expectedRowVersion: editingSetting.rowVersion });
      if (result.success) { setEditingSetting(null); await loadData(); }
      else if (result.error) setFormError(result.error);
    });
  }, [editingSetting, loadData, settingValue]);

  const closeSetting = useCallback(() => {
    if (!navigationGuard.confirmDiscard()) return;
    setEditingSetting(null);
  }, [navigationGuard]);

  return { capabilities, settings, loading, error, editingSetting, settingValue, setSettingValue, formError, isPending, updateCapability, openSetting, closeSetting, saveSetting };
}
