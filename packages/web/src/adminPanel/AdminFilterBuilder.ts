import type { FormDefinition } from "@/app/components/ui/forms";

/** Builds a filter form from the catalog and presentation context available at render time. */
export interface AdminFilterBuilder<TValues extends Record<string, unknown>, TContext> {
  build(context: TContext): FormDefinition<TValues>;
}
