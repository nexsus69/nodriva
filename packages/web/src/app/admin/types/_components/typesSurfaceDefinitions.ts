/** Defines the reusable surfaces used by the Types module. */
import { defineAdminSurface } from "@/adminPanel/AdminSurfaceDefinition";
import { ADMIN_THEME } from "@/Theme";

/** Configures the type creation form using the shared Admin theme. */
export const CREATE_TYPE_SURFACE = defineAdminSurface({
  key: "type-create",
  moduleKey: "model.types",
  tabs: [],
  initialTab: "",
  presentation: "drawer",
  placement: "right",
  appearance: ADMIN_THEME.appearance,
  initialState: {},
});
