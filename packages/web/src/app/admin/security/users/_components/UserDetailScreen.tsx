"use client";

/** Provides the complete user profile, role assignment, status, and password workflow. */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { UserDetailDto } from "@dashboard/core";
import { isUserPasswordValid } from "@dashboard/core/browser";
import { Alert, Skeleton } from "@/app/components/ui/feedback";
import { createValidationMessages, defineForm, FormRenderer, PasswordRequirements, type FormDefinition } from "@/app/components/ui/forms";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { useRouter } from "next/navigation";
import { AdminButton } from "@/adminPanel/components/AdminButton";
import { AdminPageHeader } from "@/adminPanel/components/AdminPageHeader";
import { ADMIN_THEME } from "@/Theme";

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
    fields: [{ name: "password", type: "password", label: t("admin.newPassword"), required: true }],
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
  const profileInitialValues = useMemo(() => detail ? profileValues(detail) : {}, [detail]);
  const profileSurface = useAdminFormSurface<ProfileForm>({ moduleKey: "access.users", surfaceKey: `user:${userId}:profile`, surfaceKind: "modal", draftKey: `admin.users.profile:${userId}`, formVersion: "1", initialValues: profileInitialValues });
  const passwordSurface = useAdminFormSurface<PasswordForm>({ moduleKey: "access.users", surfaceKey: `user:${userId}:password`, surfaceKind: "modal", draftKey: `admin.users.password:${userId}`, formVersion: "1", initialValues: { password: "" } });
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
    await profileSurface.submitMutation(async () => {
      await AppCache.users.updateUser({ userId, email: String(profileSurface.values.email ?? "").trim(), isSuperAdmin: Boolean(profileSurface.values.isSuperAdmin), expectedRowVersion: detail.rowVersion });
    }, async () => {
      profileSurface.complete();
      await load();
    });
  };
  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    if (!isUserPasswordValid(String(passwordSurface.values.password ?? ""))) {
      passwordSurface.reportMutationError(t("account.passwordRequirementsNotMet"));
      return;
    }
    await passwordSurface.submitMutation(async () => {
      await AppCache.users.resetUserPassword({ userId, newPassword: String(passwordSurface.values.password ?? ""), expectedRowVersion: detail.rowVersion });
    }, async () => {
      passwordSurface.complete();
      await load();
    });
  };

  if (loading) return <section className="space-y-4 border border-slate-200 bg-white p-6"><Skeleton className="h-6 w-64" /><Skeleton className="h-40 w-full" /></section>;
  if (!detail || error) return <section className="border border-slate-200 bg-white p-6"><Alert tone="danger">{error?.message ?? t("admin.userNotFound")}</Alert></section>;
  const returnToList = async () => {
    if (!(await profileSurface.close())) return;
    if (!(await passwordSurface.close())) return;
    if (onClose) onClose();
    else router.push("/admin/access/users");
  };
  return (
    <section className="space-y-6">
      <AdminPageHeader
        title={detail.email}
        description={detail.id}
        icon="users"
        breadcrumbs={[{ label: t("admin.users"), onClick: () => void returnToList() }]}
        actions={(
          <AdminButton tone="secondary" icon="arrow-left" onClick={() => void returnToList()}>
            {t("admin.backToUsers")}
          </AdminButton>
        )}
      />
      {profileForm && (
        <section className="border border-slate-200 bg-white p-6 shadow-sm">
          <FormRenderer
            definition={profileForm}
            values={profileSurface.values}
            onChange={(name, value) => profileSurface.setValues((current) => ({
              ...current,
              [name]: value,
            }))}
            onSubmit={(event) => void saveProfile(event)}
            isPending={profileSurface.isSubmitting}
            submitDisabled={!profileSurface.isDirty}
            submitLabel={t("admin.saveChanges")}
            pendingLabel={t("admin.saving")}
            theme={ADMIN_THEME.form}
            error={profileSurface.error?.message ?? null}
            mutationFailure={profileSurface.mutationFailure}
            onRetryMutation={profileSurface.retryMutation}
          />
        </section>
      )}
      <section className="border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">
          {t("admin.resetPassword")}
        </h2>
        <FormRenderer
          definition={passwordForm}
          values={passwordSurface.values}
          onChange={(name, value) => passwordSurface.setValues((current) => ({
            ...current,
            [name]: value,
          }))}
          onSubmit={(event) => void savePassword(event)}
          isPending={passwordSurface.isSubmitting}
          submitDisabled={!isUserPasswordValid(String(passwordSurface.values.password ?? ""))}
          submitLabel={t("admin.resetPassword")}
          pendingLabel={t("admin.saving")}
          theme={ADMIN_THEME.form}
          error={passwordSurface.error?.message ?? null}
          mutationFailure={passwordSurface.mutationFailure}
          onRetryMutation={passwordSurface.retryMutation}
        >
          <PasswordRequirements password={String(passwordSurface.values.password ?? "")} />
        </FormRenderer>
      </section>
    </section>
  );
}
