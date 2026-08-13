import { useEffect, useState, useTransition, type FormEvent } from 'react';
import type { ApiErrorResponse, UserDetailDto } from '@dashboard/core';
import { AppCache } from '../../../../cache/GlobalCacheClient';
import { issueAccountActionAction } from '../../../../actions/accountRecoveryActions';
import { useUnsavedChanges } from '../../../../navigation/NavigationBlocker';
import { areFormValuesEqual } from '../../../../navigation/unsavedChanges';

export function useUserDetail(userId: string) {
  const [user, setUser] = useState<UserDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editIsSuperAdmin, setEditIsSuperAdmin] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const rolesDirty = Boolean(user && !areFormValuesEqual(
    [...selectedRoleIds].sort(),
    user.roles.map((role) => role.id).sort(),
  ));
  const editDirty = Boolean(showEditModal && user && (
    editEmail !== user.email || editIsSuperAdmin !== user.isSuperAdmin
  ));
  const passwordDirty = showPasswordModal && (newPassword !== '' || confirmPassword !== '');
  const navigationGuard = useUnsavedChanges(rolesDirty || editDirty || passwordDirty);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    AppCache.users.getUser(userId).then((data) => {
      if (cancelled) return;
      setUser(data);
      setSelectedRoleIds(data.roles.map((role) => role.id));
      setEditEmail(data.email);
      setEditIsSuperAdmin(data.isSuperAdmin);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (cancelled) return;
      setError(cause as ApiErrorResponse);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const clearFeedback = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const openEditModal = () => {
    if (!user) return;
    clearFeedback();
    setEditEmail(user.email);
    setEditIsSuperAdmin(user.isSuperAdmin);
    setShowEditModal(true);
  };

  const openPasswordModal = () => {
    clearFeedback();
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleToggleStatus = () => {
    if (!user) return;
    clearFeedback();
    startTransition(async () => {
      try {
        const updated = await AppCache.users.updateUserStatus({ userId: user.id, isActive: !user.isActive, expectedRowVersion: user.rowVersion });
        setUser(updated);
        setSuccessMessage(updated.isActive ? 'Account attivato con successo.' : 'Account disabilitato con successo.');
      } catch (cause) {
        setError(cause as ApiErrorResponse);
      }
    });
  };

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoleIds((current) => current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]);
  };

  const handleSaveRoles = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    clearFeedback();
    startTransition(async () => {
      try {
        const updated = await AppCache.users.assignUserRoles({ userId: user.id, roleIds: selectedRoleIds, expectedRowVersion: user.rowVersion });
        setUser(updated);
        setSelectedRoleIds(updated.roles.map((role) => role.id));
        setSuccessMessage('Ruoli utente aggiornati con successo.');
      } catch (cause) {
        setError(cause as ApiErrorResponse);
      }
    });
  };

  const handleSaveUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    clearFeedback();
    startTransition(async () => {
      try {
        const updated = await AppCache.users.updateUser({ userId: user.id, email: editEmail.trim(), isSuperAdmin: editIsSuperAdmin, expectedRowVersion: user.rowVersion });
        setUser(updated);
        setShowEditModal(false);
        setSuccessMessage('Dati utente aggiornati con successo.');
      } catch (cause) {
        setError(cause as ApiErrorResponse);
      }
    });
  };

  const handleResetPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    clearFeedback();
    if (newPassword !== confirmPassword) {
      setError({ code: 'VALIDATION_ERROR', message: 'Le password non coincidono.' });
      return;
    }
    startTransition(async () => {
      try {
        const updated = await AppCache.users.resetUserPassword({ userId: user.id, newPassword, expectedRowVersion: user.rowVersion });
        setUser(updated);
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordModal(false);
        setSuccessMessage('Password aggiornata e sessioni attive revocate.');
      } catch (cause) {
        setError(cause as ApiErrorResponse);
      }
    });
  };

  const handleIssueAccountAction = (purpose: 'invitation' | 'password_reset') => {
    clearFeedback();
    startTransition(async () => {
      try {
        const result = await issueAccountActionAction(userId, purpose);
        setSuccessMessage(`Email inviata. Il link scade il ${new Date(result.expiresAt).toLocaleString()}.`);
      } catch (cause) {
        setError({ code: 'UNKNOWN_ERROR', message: cause instanceof Error ? cause.message : 'Invio non riuscito.' });
      }
    });
  };

  const closeEditModal = () => {
    if (editDirty && !navigationGuard.confirmDiscard()) return;
    if (user) {
      setEditEmail(user.email);
      setEditIsSuperAdmin(user.isSuperAdmin);
    }
    setShowEditModal(false);
  };

  const closePasswordModal = () => {
    if (passwordDirty && !navigationGuard.confirmDiscard()) return;
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(false);
  };

  return {
    user, loading, error, successMessage, selectedRoleIds, isPending,
    showEditModal, showPasswordModal, editEmail, editIsSuperAdmin, newPassword, confirmPassword,
    setEditEmail, setEditIsSuperAdmin, setNewPassword, setConfirmPassword,
    openEditModal, openPasswordModal,
    closeEditModal,
    closePasswordModal,
    handleToggleStatus, handleRoleToggle, handleSaveRoles, handleSaveUser, handleResetPassword, handleIssueAccountAction,
  };
}
