"use client";

/** Renders stable, sortable Admin collections with one row interaction contract. */
import {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AdminIcon } from "./AdminIcon";

export interface AdminTableColumn<TRow> {
  key: string;
  label: string;
  render: (row: TRow) => ReactNode;
  sortValue?: (row: TRow) => string | number | boolean | null | undefined;
  className?: string;
  headerClassName?: string;
}

export interface AdminTableAction<TRow> {
  key: string;
  label: string;
  icon?: string;
  tone?: "neutral" | "primary" | "danger";
  hidden?: (row: TRow) => boolean;
  onClick: (row: TRow) => void;
}

export interface AdminTableSortState {
  columnKey: string;
  direction: "ascending" | "descending";
}

/** Compares normalized column values without leaking domain ordering into the grid. */
export function compareAdminSortValues(
  left: string | number | boolean | null | undefined,
  right: string | number | boolean | null | undefined,
): number {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/** Sorts the complete collection before consumers derive a pagination window. */
export function sortAdminRows<TRow>(
  rows: readonly TRow[],
  columns: readonly AdminTableColumn<TRow>[],
  sort: AdminTableSortState | null,
): readonly TRow[] {
  if (!sort) return rows;
  const column = columns.find((candidate) => candidate.key === sort.columnKey);
  if (!column?.sortValue) return rows;
  const direction = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort(
    (left, right) => direction * compareAdminSortValues(
      column.sortValue?.(left),
      column.sortValue?.(right),
    ),
  );
}

/** Renders a row action menu and clears transient state when its route is hidden. */
function AdminRowActions<TRow>({
  row,
  actions,
  label,
}: {
  row: TRow;
  actions: readonly AdminTableAction<TRow>[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      setOpen(false);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return undefined;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = actions.length * 36 + 16;
    const menuWidth = 176;
    const top = rect.bottom + 4 + menuHeight <= window.innerHeight
      ? rect.bottom + 4
      : Math.max(8, rect.top - menuHeight - 4);
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    setMenuPosition({ top, left });
    return undefined;
  }, [actions.length, open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const closeOnViewportChange = () => setOpen(false);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex size-8 items-center justify-center border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <AdminIcon name="more" className="size-5" />
      </button>
      {open && menuPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left, width: 176 }}
          className="z-[100] border border-slate-200 bg-white p-1.5 text-left shadow-xl shadow-slate-900/10"
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                action.onClick(row);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition ${action.tone === "danger" ? "text-rose-700 hover:bg-rose-50" : action.tone === "primary" ? "text-violet-700 hover:bg-violet-50" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {action.icon && <AdminIcon name={action.icon} className="size-4 shrink-0" />}
              {action.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Renders one memoized row so unrelated collection state does not repaint it. */
function AdminTableRowBase<TRow extends { id: string }>({
  row,
  columns,
  actions,
  onOpen,
  rowLabel,
  actionMenuLabel,
  selected,
}: {
  row: TRow;
  columns: readonly AdminTableColumn<TRow>[];
  actions?: readonly AdminTableAction<TRow>[];
  onOpen?: (row: TRow) => void;
  rowLabel?: (row: TRow) => string;
  actionMenuLabel: string;
  selected: boolean;
}) {
  const visibleActions = actions?.filter((action) => !action.hidden?.(row)) ?? [];
  const activate = () => onOpen?.(row);
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return;
    if (!onOpen || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    activate();
  };

  return (
    <tr
      tabIndex={onOpen ? 0 : undefined}
      aria-label={rowLabel?.(row)}
      aria-selected={selected || undefined}
      onClick={onOpen ? activate : undefined}
      onKeyDown={handleKeyDown}
      className={`group transition-colors ${onOpen ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500" : ""} ${selected ? "bg-violet-50" : "hover:bg-slate-50/80"}`}
    >
      {columns.map((column) => (
        <td
          key={column.key}
          data-label={column.label}
          className={`px-4 py-3.5 align-middle text-sm text-slate-700 ${column.className ?? ""}`}
        >
          {column.render(row)}
        </td>
      ))}
      {visibleActions.length > 0 && (
        <td data-label="" className="w-12 px-3 py-2 text-right">
          <AdminRowActions
            row={row}
            actions={visibleActions}
            label={actionMenuLabel}
          />
        </td>
      )}
    </tr>
  );
}

const AdminTableRow = memo(AdminTableRowBase) as typeof AdminTableRowBase;

/** Presents one ordinary Admin data grid with optional sorting and row opening. */
export function AdminTable<TRow extends { id: string }>({
  rows,
  columns,
  actions,
  emptyLabel,
  onOpen,
  rowLabel,
  actionMenuLabel,
  selectedRowId,
  sort: controlledSort,
  onSortChange,
}: {
  rows: readonly TRow[];
  columns: readonly AdminTableColumn<TRow>[];
  actions?: readonly AdminTableAction<TRow>[];
  emptyLabel: string;
  onOpen?: (row: TRow) => void;
  rowLabel?: (row: TRow) => string;
  actionMenuLabel: string;
  selectedRowId?: string;
  sort?: AdminTableSortState | null;
  onSortChange?: (sort: AdminTableSortState) => void;
}) {
  const [localSort, setLocalSort] = useState<AdminTableSortState | null>(null);
  const sort = controlledSort === undefined ? localSort : controlledSort;
  const sortedRows = useMemo(() => {
    return sortAdminRows(rows, columns, sort);
  }, [columns, rows, sort]);

  const toggleSort = (columnKey: string) => {
    const next: AdminTableSortState = sort?.columnKey === columnKey
      ? {
          columnKey,
          direction: sort.direction === "ascending" ? "descending" : "ascending",
        }
      : { columnKey, direction: "ascending" };
    if (onSortChange) onSortChange(next);
    else setLocalSort(next);
  };

  return (
    <div className="overflow-hidden border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="max-w-full overflow-x-auto">
        <table className="admin-mobile-cards w-full min-w-[42rem] border-collapse text-left">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  aria-sort={sort?.columnKey === column.key ? sort.direction : undefined}
                  className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 ${column.headerClassName ?? column.className ?? ""}`}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900"
                    >
                      {column.label}
                      <AdminIcon
                        name="chevron-down"
                        className={`size-3 transition ${sort?.columnKey === column.key && sort.direction === "ascending" ? "rotate-180 text-violet-600" : ""}`}
                      />
                    </button>
                  ) : column.label}
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th className="w-12 px-3 py-3">
                  <span className="sr-only">{actionMenuLabel}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.map((row) => (
              <AdminTableRow
                key={row.id}
                row={row}
                columns={columns}
                actions={actions}
                onOpen={onOpen}
                rowLabel={rowLabel}
                actionMenuLabel={actionMenuLabel}
                selected={selectedRowId === row.id}
              />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="p-8 text-center text-sm text-slate-500">{emptyLabel}</p>
      )}
    </div>
  );
}
