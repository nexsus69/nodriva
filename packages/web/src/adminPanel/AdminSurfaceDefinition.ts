/** Describes a reusable administrative surface independently from its content. */
export interface AdminSurfaceDefinition<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  key: string;
  moduleKey: string;
  tabs: readonly string[];
  initialTab: string;
  presentation: "inline" | "drawer" | "modal";
  placement?: "left" | "right" | "center";
  size?: "sm" | "md" | "lg" | "xl" | "full";
  appearance?: "light" | "dark";
  initialState: TState;
}

/** Creates a serializable surface definition that can be instantiated by any module. */
export function defineAdminSurface<
  TState extends Record<string, unknown>,
  TPresentation extends AdminSurfaceDefinition["presentation"],
>(
  definition: AdminSurfaceDefinition<TState> & {
    presentation: TPresentation;
  },
): AdminSurfaceDefinition<TState> & { presentation: TPresentation } {
  return definition;
}
