import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Identifies a modal or drawer that is part of the restored admin workspace. */
export interface AdminSurfaceState {
  kind: "modal" | "drawer";
  key: string;
  moduleKey: string;
  mode?: "create" | "edit" | "detail";
  resourceId?: string;
}

/** Stores an unsaved form draft without making it authoritative application data. */
export interface AdminFormDraft {
  key: string;
  values: Record<string, unknown>;
  formVersion: string;
  updatedAt: number;
  /** Captures the record values used as the dirty-state baseline. */
  baseline?: Record<string, unknown>;
  rowVersion?: number;
}

/** Serializable workspace state that can be restored after a browser reload. */
export interface AdminWorkspacePersistedState {
  userId: string | null;
  activeModuleKey: string;
  expandedModuleKeys: string[];
  selectedResource: { moduleKey: string; resourceId?: string } | null;
  surface: AdminSurfaceState | null;
  drafts: Record<string, AdminFormDraft>;
  moduleState: Record<string, Record<string, unknown>>;
}

/** Exposes navigation and draft transitions for the Admin Panel composition layer. */
export interface AdminWorkspaceState extends AdminWorkspacePersistedState {
  /** Prevents restored workspace data from racing an interactive form surface. */
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setUserContext: (userId: string | null) => void;
  setActiveModule: (moduleKey: string) => void;
  expandModule: (moduleKey: string) => void;
  toggleModule: (moduleKey: string) => void;
  selectResource: (
    selection: { moduleKey: string; resourceId?: string } | null,
  ) => void;
  openSurface: (surface: AdminSurfaceState) => void;
  closeSurface: () => void;
  saveDraft: (draft: AdminFormDraft) => void;
  removeDraft: (draftKey: string) => void;
  setModuleState: (moduleKey: string, values: Record<string, unknown>) => void;
  clearModuleState: (moduleKey: string) => void;
  resetWorkspace: () => void;
}

/** Default state used for a new user context or an explicit workspace reset. */
export const DEFAULT_ADMIN_WORKSPACE_STATE: AdminWorkspacePersistedState = {
  userId: null,
  activeModuleKey: "overview",
  expandedModuleKeys: [],
  selectedResource: null,
  surface: null,
  drafts: {},
  moduleState: {},
};

/**
 * Merges the asynchronous browser restoration without allowing it to replace
 * work that was already initialized for the current authenticated user.
 */
export function mergeAdminWorkspaceState(
  persistedState: unknown,
  currentState: AdminWorkspaceState,
): AdminWorkspaceState {
  const persisted = persistedState as Partial<AdminWorkspacePersistedState>;
  const currentUserId = currentState.userId;
  const persistedUserId = persisted.userId ?? null;
  const hasLocalWork = currentState.surface !== null || Object.keys(currentState.drafts).length > 0;
  // Session discovery and persist hydration run independently. Once the shell
  // has established an identity, an empty or different persisted identity is
  // stale state, not an instruction to reset the active workspace.
  const canRestorePersistedWorkspace = currentUserId === null || currentUserId === persistedUserId;

  if (!canRestorePersistedWorkspace || hasLocalWork) return currentState;

  return {
    ...currentState,
    ...persisted,
    userId: currentUserId ?? persistedUserId,
    surface: persisted.surface ?? null,
    drafts: persisted.drafts ?? {},
    moduleState: persisted.moduleState ?? {},
  };
}

/** Creates the browser storage adapter while remaining safe during server rendering. */
function adminWorkspaceStorage() {
  const memory = new Map<string, string>();
  return createJSONStorage<AdminWorkspacePersistedState>(() => {
    if (typeof window !== "undefined") return window.sessionStorage;
    return {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };
  });
}

/** Zustand store that restores the administrative work context without persisting secrets. */
export const useAdminWorkspaceStore = create<AdminWorkspaceState>()(
  persist(
    (set) => ({
      ...DEFAULT_ADMIN_WORKSPACE_STATE,
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setUserContext: (userId) =>
        set((state) =>
          state.userId === userId
            ? { userId }
            : { ...DEFAULT_ADMIN_WORKSPACE_STATE, userId },
        ),
      setActiveModule: (activeModuleKey) => set((state) =>
        state.activeModuleKey === activeModuleKey
          ? { activeModuleKey }
          : { activeModuleKey, selectedResource: null, surface: null },
      ),
      expandModule: (moduleKey) =>
        set((state) => ({
          expandedModuleKeys: state.expandedModuleKeys.includes(moduleKey)
            ? state.expandedModuleKeys
            : [...state.expandedModuleKeys, moduleKey],
        })),
      toggleModule: (moduleKey) =>
        set((state) => ({
          expandedModuleKeys: state.expandedModuleKeys.includes(moduleKey)
            ? state.expandedModuleKeys.filter((key) => key !== moduleKey)
            : [...state.expandedModuleKeys, moduleKey],
        })),
      selectResource: (selectedResource) => set({ selectedResource }),
      openSurface: (surface) => set({ surface }),
      closeSurface: () => set({ surface: null }),
      saveDraft: (draft) =>
        set((state) => ({ drafts: { ...state.drafts, [draft.key]: draft } })),
      removeDraft: (draftKey) =>
        set((state) => {
          const drafts = { ...state.drafts };
          delete drafts[draftKey];
          return { drafts };
        }),
      setModuleState: (moduleKey, values) =>
        set((state) => ({
          moduleState: {
            ...state.moduleState,
            [moduleKey]: { ...state.moduleState[moduleKey], ...values },
          },
        })),
      clearModuleState: (moduleKey) =>
        set((state) => {
          const moduleState = { ...state.moduleState };
          delete moduleState[moduleKey];
          return { moduleState };
        }),
      resetWorkspace: () =>
        set((state) => ({
          ...DEFAULT_ADMIN_WORKSPACE_STATE,
          userId: state.userId,
        })),
    }),
    {
      name: "nodriva-admin-workspace",
      version: 1,
      storage: adminWorkspaceStorage(),
      partialize: (state) => ({
        userId: state.userId,
        activeModuleKey: state.activeModuleKey,
        expandedModuleKeys: state.expandedModuleKeys,
        selectedResource: state.selectedResource,
        surface: state.surface,
        drafts: state.drafts,
        moduleState: state.moduleState,
      }),
      merge: mergeAdminWorkspaceState,
      migrate: (persistedState) => ({
        ...DEFAULT_ADMIN_WORKSPACE_STATE,
        ...(persistedState as Partial<AdminWorkspacePersistedState>),
      }),
      onRehydrateStorage: () => (state) => {
        // Persist applies its merged state after this callback. Deferring the
        // marker prevents that merge from resetting the non-persisted flag.
        queueMicrotask(() => state?.setHasHydrated(true));
      },
    },
  ),
);
