"use client";

/** Renders the shared English/Italian locale selector for frontend surfaces. */
import { useAppLocale } from "@/app/i18n/AppLocaleStore";

/** Provides compact locale buttons while preserving the current workspace. */
export function LocaleSwitcher() {
  const { locale, setLocale } = useAppLocale();
  return (
    <div
      className="flex items-center gap-1 border border-slate-200 bg-slate-50 p-1"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`px-2 py-1 text-[10px] font-bold ${locale === "en" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-400"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("it")}
        aria-pressed={locale === "it"}
        className={`px-2 py-1 text-[10px] font-bold ${locale === "it" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-400"}`}
      >
        IT
      </button>
    </div>
  );
}
