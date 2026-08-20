'use client';

import Link from '@/app/components/navigation/GuardedLink';
import { Skeleton, SkeletonState } from '@/app/components/ui/feedback';
import { AdminResourceLock } from '../../../_components/AdminResourceLock';
import { UserAccountDetailsPanel, UserRoleAssignmentPanel } from '../../_components/UserDetailPanels';
import { UserDetailHeader } from './UserDetailHeader';
import { UserDetailModals } from './UserDetailModals';
import { useUserDetail } from '../_hooks/useUserDetail';

export function UserDetailScreen({ userId }: { userId: string }) {
  const controller = useUserDetail(userId);
  if (controller.loading) return <SkeletonState label="Caricamento dettaglio utente" className="space-y-6"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><Skeleton className="h-14 w-14 rounded-full" /><div className="space-y-2"><Skeleton className="h-5 w-52" /><Skeleton className="h-3 w-28" /></div></div><Skeleton className="h-9 w-28" /></div><div className="grid grid-cols-1 gap-6 md:grid-cols-2"><Skeleton className="h-64 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div></SkeletonState>;
  if (!controller.user) return <div className="space-y-4"><Link href="/admin/users" className="text-xs text-indigo-400">&larr; Torna alla lista utenti</Link><div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Impossibile caricare l&apos;utente</strong><p>{controller.error?.message ?? 'Utente non trovato.'}</p></div></div>;
  const user = controller.user;
  return <div className="space-y-6">
    <AdminResourceLock resourceType="user" resourceId={user.id} />
    <UserDetailHeader user={user} isPending={controller.isPending} onEdit={controller.openEditModal} onResetPassword={controller.openPasswordModal} onIssueAccountAction={controller.handleIssueAccountAction} onToggleStatus={controller.handleToggleStatus} />
    {controller.successMessage && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">{controller.successMessage}</div>}
    {controller.error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300"><strong>Errore [{controller.error.code}]:</strong> {controller.error.message}</div>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><UserAccountDetailsPanel user={user} /><UserRoleAssignmentPanel user={user} selectedRoleIds={controller.selectedRoleIds} isPending={controller.isPending} onToggle={controller.handleRoleToggle} onSubmit={controller.handleSaveRoles} /></div>
    <UserDetailModals showEditModal={controller.showEditModal} showPasswordModal={controller.showPasswordModal} editEmail={controller.editEmail} editIsSuperAdmin={controller.editIsSuperAdmin} newPassword={controller.newPassword} confirmPassword={controller.confirmPassword} error={controller.error} isPending={controller.isPending} setEditEmail={controller.setEditEmail} setEditIsSuperAdmin={controller.setEditIsSuperAdmin} setNewPassword={controller.setNewPassword} setConfirmPassword={controller.setConfirmPassword} closeEditModal={controller.closeEditModal} closePasswordModal={controller.closePasswordModal} onSaveUser={controller.handleSaveUser} onResetPassword={controller.handleResetPassword} />
  </div>;
}
