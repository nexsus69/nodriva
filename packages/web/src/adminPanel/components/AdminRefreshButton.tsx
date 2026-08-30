import { AdminButton } from "./AdminButton";

/** Provides the shared visual and interaction contract for administrative refresh actions. */
export function AdminRefreshButton({
  label,
  onRefresh,
}: {
  label: string;
  onRefresh: () => void;
}) {
  return (
    <AdminButton
      tone="quiet"
      compact
      icon="refresh"
      onClick={onRefresh}
      aria-label={label}
      className="w-fit whitespace-nowrap"
    >
      <span>{label}</span>
    </AdminButton>
  );
}
