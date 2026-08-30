import { AdminButton } from "./AdminButton";

/** Provides the shared responsive contract for administrative refresh actions. */
export function AdminRefreshButton({
  label,
  onRefresh,
}: {
  label: string;
  onRefresh: () => void;
}) {
  return (
    <AdminButton tone="quiet" compact icon="refresh" onClick={onRefresh} aria-label={label}>
      <span className="hidden sm:inline">{label}</span>
    </AdminButton>
  );
}
