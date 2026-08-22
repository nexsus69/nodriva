/** Renders the compact header shared by all Admin Panel modules. */
import { LocaleSwitcher } from "@/app/components/ui/feedback/LocaleSwitcher";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";

export function AdminPanelHeader({
  email,
  activeModuleLabel,
  onOpenSidebar,
}: {
  email: string;
  activeModuleLabel: string;
  onOpenSidebar: () => void;
}) {
  const { t } = useAppLocale();
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label={t("admin.openMenu")}
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-600 lg:hidden"
      >
        ☰
      </button>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
          {t("admin.panel")}
        </p>
        <h1 className="truncate text-sm font-semibold text-slate-900">
          {activeModuleLabel}
        </h1>
      </div>
      <LocaleSwitcher />
      <div className="ml-auto truncate text-xs text-slate-500">{email}</div>
    </header>
  );
}
