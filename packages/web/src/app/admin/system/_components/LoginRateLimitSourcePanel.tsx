"use client";

/** Provides the shared-form, audited administration flow for a known source-address block. */
import { useMemo, useState, type FormEvent } from "react";
import { defineForm, FormRenderer, type FormDefinition } from "@/app/components/ui/forms";
import { Alert } from "@/app/components/ui/feedback";
import { requestConfirmation } from "@/app/components/ui/feedback/ConfirmDialogStore";
import { useUserMutation } from "@/app/mutations/useUserMutation";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { getSourceLoginRateLimitAction, releaseSourceLoginRateLimitAction } from "@/app/actions/loginRateLimitActions";
import { ADMIN_THEME } from "@/Theme";
import { AdminButton } from "@/adminPanel/components/AdminButton";
import { formatAdminDateTime } from "@/adminPanel/adminFormatters";

type SourceAddressForm = { sourceAddress: string };

function sourceAddressForm(t: (key: string) => string): FormDefinition<SourceAddressForm> {
  return defineForm({
    key: "admin.login-protection.source-address",
    version: "1",
    fields: [{ name: "sourceAddress", type: "text", label: t("admin.loginProtectionSourceAddress"), description: t("admin.loginProtectionSourceAddressDescription"), required: true, placeholder: "203.0.113.42" }],
  });
}

/** Keeps source-address lookup and release within the standard mutation-feedback lifecycle. */
export function LoginRateLimitSourcePanel() {
  const { t, locale } = useAppLocale();
  const mutation = useUserMutation();
  const [values, setValues] = useState<SourceAddressForm>({ sourceAddress: "" });
  const [checked, setChecked] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const definition = useMemo(() => sourceAddressForm(t), [t]);
  const sourceAddress = values.sourceAddress.trim();

  const checkStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const outcome = await mutation.execute(async () => {
      const result = await getSourceLoginRateLimitAction(sourceAddress);
      if (!result.success) throw result.error;
      return result.data;
    }, (status) => { setChecked(true); setBlockedUntil(status.blockedUntil); }, { notifySuccess: false });
    if (!outcome.ok) { setChecked(false); setBlockedUntil(null); }
  };

  const release = async () => {
    if (!blockedUntil) return;
    const confirmed = await requestConfirmation({ title: t("admin.releaseLoginRateLimitTitle"), description: t("admin.releaseSourceLoginRateLimitDescription"), confirmLabel: t("admin.releaseLoginRateLimit"), cancelLabel: t("admin.cancel"), tone: "neutral" });
    if (!confirmed) return;
    await mutation.execute(async () => {
      const result = await releaseSourceLoginRateLimitAction(sourceAddress);
      if (!result.success) throw result.error;
    }, () => setBlockedUntil(null), { successKey: "admin.loginRateLimitReleased" });
  };

  return <section className="border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="font-semibold text-slate-900">{t("admin.loginProtection")}</h2>
    <p className="mt-2 text-sm text-slate-600">{t("admin.loginProtectionDescription")}</p>
    <div className="mt-5 max-w-xl"><FormRenderer definition={definition} values={values} onChange={(name, value) => { setValues((current) => ({ ...current, [name]: value })); setChecked(false); setBlockedUntil(null); }} onSubmit={(event) => void checkStatus(event)} isPending={mutation.pending} submitDisabled={!sourceAddress} submitLabel={t("admin.checkLoginRateLimit")} pendingLabel={t("admin.checkingLoginRateLimit")} theme={ADMIN_THEME.form} mutationFailure={mutation.failure} onRetryMutation={mutation.retry} /></div>
    {checked && !blockedUntil && !mutation.failure && <Alert tone="info" className="mt-4">{t("admin.loginRateLimitNotBlocked")}</Alert>}
    {blockedUntil && <div className="mt-4 space-y-4"><Alert tone="warning">{t("admin.loginRateLimitBlockedUntil").replace("{time}", formatAdminDateTime(blockedUntil, locale))}</Alert><AdminButton icon="shield" onClick={() => void release()} disabled={mutation.pending}>{t("admin.releaseLoginRateLimit")}</AdminButton></div>}
  </section>;
}
