/** Renders the shared accessible switch control for boolean form values. */
export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  onLabel,
  offLabel,
  showLabel = false,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  onLabel?: string;
  offLabel?: string;
  /** Shows the field label beside the control; inline table controls can keep it accessible-only. */
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
      }}
      className={`inline-flex min-h-7 items-center gap-2 rounded-full text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 rounded-full p-0.5 transition-colors ${checked ? "bg-violet-600" : "bg-slate-300"}`}
      >
        <span className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
      {showLabel && label && <span className="text-left">{label}</span>}
      {(onLabel || offLabel) && (
        <span className={checked ? "text-violet-700" : "text-slate-500"}>
          {checked ? onLabel : offLabel}
        </span>
      )}
    </button>
  );
}
