"use client";

/** Provides the complete user profile, role assignment, status, and password workflow. */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { UserDetailDto } from "@dashboard/core";
import { Alert, Skeleton } from "@/app/components/ui/feedback";
import { createValidationMessages, defineForm, FormRenderer, type FormDefinition } from "@/app/components/ui/forms";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { useRouter } from "next/navigation";

type ProfileForm = Record<string, unknown>;
type PasswordForm = { password: string };

/** Builds the profile form from the roles returned by the authoritative detail payload. */
function profileDefinition(t: (key: string) => string): FormDefinition<ProfileForm> {
  return defineForm({
    key: "admin.users.profile",
    version: "1",
    validationMessages: createValidationMessages(t),
    fields: [
      { name: "email", type: "email", label: t("admin.email"), required: true, validation: { email: true }, layout: { row: "identity", colSpan: 2, order: 1 } },
      { name: "isSuperAdmin", type: "boolean", label: t("admin.superAdmin"), description: t("admin.superAdminHelp"), layout: { row: "identity", colSpan: 2, order: 2 } },
    ],
    sections: [
      { key: "identity", label: t("admin.identity"), fieldNames: ["email", "isSuperAdmin"], columns: 2 },
    ],
    layout: { columns: 2, gap: "normal" },
  });
}

/** Builds the password reset form using the same validation contract as every other form. */
function passwordDefinition(t: (key: string) => string): FormDefinition<PasswordForm> {
  return defineForm({
    key: "admin.users.password",
    version: "1",
    validationMessages: createValidationMessages(t),
    fields: [{ name: "password", type: "password", label: t("admin.newPassword"), required: true, validation: { minLength: 12 } }],
  });
}

function profileValues(detail: UserDetailDto): ProfileForm {
  return {
    email: detail.email,
    isSuperAdmin: detail.isSuperAdmin,
  };
}

/** Renders every mutable user concern while preserving drafts across reloads. */
export function UserDetailScreen({ userId, onClose }: { userId: string; onClose?: () => void }) {
  const router = useRouter();
  const { t } = useAppLocale();
  const [detail, setDetail] = useState<UserDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const profileInitialValues = useMemo(() => detail ? profileValues(detail) : {}, [detail]);
  const profileSurface = useAdminFormSurface<ProfileForm>({ moduleKey: "access.users", surfaceKey: `user:${userId}:profile`, surfaceKind: "modal", draftKey: `admin.users.profile:${userId}`, formVersion: "1", initialValues: profileInitialValues, closePolicy: "discard", confirmOnDiscard: true, confirmTitle: t("admin.discardTitle"), confirmDescription: t("admin.discardDescription"), confirmConfirmLabel: t("admin.discardChanges"), confirmCancelLabel: t("admin.keepEditing") });
  const passwordSurface = useAdminFormSurface<PasswordForm>({ moduleKey: "access.users", surfaceKey: `user:${userId}:password`, surfaceKind: "modal", draftKey: `admin.users.password:${userId}`, formVersion: "1", initialValues: { password: "" }, closePolicy: "discard" });
  const profileForm = useMemo(() => detail ? profileDefinition(t) : null, [detail, t]);
  const passwordForm = useMemo(() => passwordDefinition(t), [t]);

  const load = async () => {
    setLoading(true);
    try {
      setDetail(await AppCache.users.getUser(userId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void Promise.resolve().then(load);
    // Reload only when the selected identity changes; mutations call load directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    setPending(true);
    try {
      await AppCache.users.updateUser({ userId, email: String(profileSurface.values.email ?? "").trim(), isSuperAdmin: Boolean(profileSurface.values.isSuperAdmin), expectedRowVersion: detail.rowVersion });
      profileSurface.complete();
      await load();
    } finally { setPending(false); }
  };
  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    setPending(true);
    try {
      await AppCache.users.resetUserPassword({ userId, newPassword: String(passwordSurface.values.password ?? ""), expectedRowVersion: detail.rowVersion });
      passwordSurface.complete();
      await load();
    } finally { setPending(false); }
  };

  if (loading) return <section className="space-y-4 border border-slate-200 bg-white p-6"><Skeleton className="h-6 w-64" /><Skeleton className="h-40 w-full" /></section>;
  if (!detail || error) return <section className="border border-slate-200 bg-white p-6"><Alert tone="danger">{error?.message ?? t("admin.userNotFound")}</Alert></section>;
  const returnToList = async () => {
    if (!(await profileSurface.close())) return;
    if (!(await passwordSurface.close())) return;
    if (onClose) onClose();
    else router.push("/admin/users");
  };
  return (
    <section className="space-y-6">
      <header className="border border-slate-200 bg-white p-6"><button type="button" onClick={() => void returnToList()} className="text-xs font-semibold text-indigo-600">← {t("admin.backToUsers")}</button><h1 className="mt-3 text-2xl font-semibold text-slate-900">{detail.email}</h1><p className="mt-1 font-mono text-xs text-slate-500">{detail.id}</p></header>
      {profileForm && <section className="border border-slate-200 bg-white p-6"><FormRenderer definition={profileForm} values={profileSurface.values} onChange={(name, value) => profileSurface.setValues((current) => ({ ...current, [name]: value }))} onSubmit={(event) => void saveProfile(event)} isPending={pending} submitDisabled={!profileSurface.isDirty} submitLabel={t("admin.saveChanges")} pendingLabel={t("admin.saving")} theme="light" /></section>}
      <section className="border border-slate-200 bg-white p-6"><h2 className="mb-4 font-semibold text-slate-900">{t("admin.resetPassword")}</h2><FormRenderer definition={passwordForm} values={passwordSurface.values} onChange={(name, value) => passwordSurface.setValues((current) => ({ ...current, [name]: value }))} onSubmit={(event) => void savePassword(event)} isPending={pending} submitLabel={t("admin.resetPassword")} pendingLabel={t("admin.saving")} theme="light" /></section>
    </section>
  );
}
