/** Defines the reusable surfaces used by the Types module. */
import { defineAdminSurface } from "@/adminPanel/AdminSurfaceDefinition";

/** Configures the type creation form as a right-hand dark drawer. */
export const CREATE_TYPE_SURFACE = defineAdminSurface({
  key: "type-create",
  moduleKey: "model.types",
  tabs: [],
  initialTab: "",
  presentation: "drawer",
  placement: "right",
  appearance: "dark",
  initialState: {},
});
