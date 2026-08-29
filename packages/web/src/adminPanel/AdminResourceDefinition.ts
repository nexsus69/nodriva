import type { FormDefinition } from "@/app/components/ui/forms";
import type { AdminSurfaceDefinition } from "./AdminSurfaceDefinition";
import type { AdminTableAction, AdminTableColumn } from "./components/AdminTable";

/** Identifies the permissions required by the standard resource lifecycle. */
export interface AdminResourcePermissions {
  read?: readonly string[];
  create?: readonly string[];
  update?: readonly string[];
  delete?: readonly string[];
  mode?: "all" | "any";
}

/** Describes one mutation or navigation action available for a resource row. */
export interface AdminResourceAction<TRow, TContext = unknown>
  extends Omit<AdminTableAction<TRow>, "onClick" | "hidden"> {
  permission?: string;
  isVisible?: (row: TRow, context: TContext) => boolean;
  execute: (row: TRow, context: TContext) => Promise<void> | void;
}

/** Defines the read side of an administrative resource. */
export interface AdminResourceListDefinition<TRow extends { id: string }> {
  load: () => Promise<readonly TRow[]>;
  /** Cache dependencies whose realtime invalidation requires a fresh list read. */
  realtimeDependencies?: readonly string[];
  columns: readonly AdminTableColumn<TRow>[];
  emptyLabel: string;
  loadingLabel: string;
  toSearchText?: (row: TRow) => string;
}

/** Defines detail loading and optional form-backed mutations for a resource. */
export interface AdminResourceDetailDefinition<
  TId,
  TDetail,
  TForm extends Record<string, unknown>,
> {
  load: (id: TId) => Promise<TDetail>;
  form?: FormDefinition<TForm>;
  create?: (input: TForm) => Promise<TDetail>;
  update?: (id: TId, input: TForm, expectedRowVersion?: number) => Promise<TDetail>;
}

/**
 * Complete contract for an administrative resource.
 *
 * Modules provide data adapters and declarative UI definitions. Controllers and
 * surface hosts own loading, drafts, validation, confirmation, and transitions.
 */
export interface AdminResourceDefinition<
  TRow extends { id: string },
  TDetail = TRow,
  TForm extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
  TId = string,
> {
  key: string;
  moduleKey: string;
  label: string;
  description: string;
  permissions?: AdminResourcePermissions;
  list: AdminResourceListDefinition<TRow>;
  detail?: AdminResourceDetailDefinition<TId, TDetail, TForm>;
  actions?: readonly AdminResourceAction<TRow, TContext>[];
  surfaces?: readonly AdminSurfaceDefinition[];
}

/** Creates and validates a reusable administrative resource definition. */
export function defineAdminResource<
  TRow extends { id: string },
  TDetail = TRow,
  TForm extends Record<string, unknown> = Record<string, unknown>,
  TContext = unknown,
  TId = string,
>(
  definition: AdminResourceDefinition<TRow, TDetail, TForm, TContext, TId>,
): AdminResourceDefinition<TRow, TDetail, TForm, TContext, TId> {
  const columnKeys = definition.list.columns.map((column) => column.key);
  if (new Set(columnKeys).size !== columnKeys.length) {
    throw new Error(`Admin resource '${definition.key}' contains duplicate list columns.`);
  }

  const surfaceKeys = (definition.surfaces ?? []).map((surface) => surface.key);
  if (new Set(surfaceKeys).size !== surfaceKeys.length) {
    throw new Error(`Admin resource '${definition.key}' contains duplicate surfaces.`);
  }

  return definition;
}

/** Evaluates a declared resource operation against the verified UI projection. */
export function canUseAdminResourceOperation<
  TRow extends { id: string },
  TDetail,
  TForm extends Record<string, unknown>,
  TContext,
  TId,
>(
  definition: AdminResourceDefinition<TRow, TDetail, TForm, TContext, TId>,
  operation: keyof Omit<AdminResourcePermissions, "mode">,
  permissions: ReadonlySet<string>,
): boolean {
  const required = definition.permissions?.[operation] ?? [];
  if (required.length === 0) return true;
  return definition.permissions?.mode === "any"
    ? required.some((permission) => permissions.has(permission))
    : required.every((permission) => permissions.has(permission));
}
