/** Renders the compact header shared by all Admin Panel modules. */
import { LocaleSwitcher } from "@/app/components/ui/feedback/LocaleSwitcher";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import { AdminIcon } from "@/adminPanel/components/AdminIcon";

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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-5">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label={t("admin.openMenu")}
        className="flex size-9 items-center justify-center border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
      >
        <AdminIcon name="menu" className="size-4" />
      </button>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
        {activeModuleLabel}
      </p>
      <LocaleSwitcher />
      <div className="hidden h-6 w-px bg-slate-200 sm:block" />
      <div className="flex min-w-0 items-center gap-2" title={email}>
        <span className="flex size-7 shrink-0 items-center justify-center bg-blue-100 text-[11px] font-bold uppercase text-blue-700">{email.slice(0, 1)}</span>
        <span className="hidden max-w-48 truncate text-xs text-slate-500 md:block">{email}</span>
      </div>
    </header>
  );
}
