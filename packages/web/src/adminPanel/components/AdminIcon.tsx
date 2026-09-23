/** Renders the canonical SVG icon vocabulary used by every Admin surface. */
import type { ReactNode, SVGProps } from "react";

export type AdminIconName =
  | "activity"
  | "arrow-left"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "close"
  | "dashboard"
  | "database"
  | "entities"
  | "external"
  | "menu"
  | "more"
  | "nodes"
  | "plus"
  | "recycle"
  | "refresh"
  | "roles"
  | "schema"
  | "search"
  | "settings"
  | "shield"
  | "scope"
  | "user"
  | "users";

const paths: Record<AdminIconName, ReactNode> = {
  activity: <><path d="M4 12h3l2-6 4 12 2-6h5" /></>,
  "arrow-left": <><path d="m15 18-6-6 6-6" /></>,
  "chevron-down": <><path d="m6 9 6 6 6-6" /></>,
  "chevron-left": <><path d="m15 18-6-6 6-6" /></>,
  "chevron-right": <><path d="m9 18 6-6-6-6" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  entities: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="9" y="14" width="6" height="6" rx="1" /><path d="M7 10v2h10v-2M12 12v2" /></>,
  external: <><path d="M14 3h7v7M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  more: <><circle cx="12" cy="5" r="1.25" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.25" fill="currentColor" stroke="none" /></>,
  nodes: <><circle cx="12" cy="5" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M12 7.5v4M6 15.5v-4h12v4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  recycle: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7L20 14" /><path d="M20 6v5h-5" /></>,
  roles: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2.7-6 6-6s6 2 6 6" /><path d="M16 11h5M18.5 8.5v5" /></>,
  schema: <><rect x="3" y="4" width="7" height="6" rx="1" /><rect x="14" y="14" width="7" height="6" rx="1" /><path d="M10 7h4a3 3 0 0 1 3 3v4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.7 3 7.8 7.5 9.5 4.5-1.7 7.5-4.8 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
  scope: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  user: <><circle cx="12" cy="8" r="3" /><path d="M5 21c0-4.2 3.1-7 7-7s7 2.8 7 7" /></>,
  users: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20c0-4 2.5-6 5.5-6s5.5 2 5.5 6M14 15c3.4-.6 6 1.2 6.8 4.2" /></>,
};

/** Produces a consistent stroke icon while allowing module definitions to use strings. */
export function AdminIcon({
  name,
  className = "size-5",
  ...props
}: Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: string;
}) {
  const resolved = name in paths ? name as AdminIconName : "dashboard";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {paths[resolved]}
    </svg>
  );
}
