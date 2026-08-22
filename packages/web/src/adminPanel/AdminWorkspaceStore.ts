import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Identifies a modal or drawer that is part of the restored admin workspace. */
export interface AdminSurfaceState {
  kind: "modal" | "drawer";
  key: string;
  moduleKey: string;
  resourceId?: string;
}

/** Stores an unsaved form draft without making it authoritative application data. */
export interface AdminFormDraft {
  key: string;
  values: Record<string, unknown>;
  formVersion: string;
  updatedAt: number;
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
      setUserContext: (userId) =>
        set((state) =>
          state.userId === userId
            ? { userId }
            : { ...DEFAULT_ADMIN_WORKSPACE_STATE, userId },
        ),
      setActiveModule: (activeModuleKey) => set({ activeModuleKey }),
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
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<AdminWorkspacePersistedState>),
        moduleState:
          (persistedState as Partial<AdminWorkspacePersistedState>)
            .moduleState ?? {},
      }),
      migrate: (persistedState) => ({
        ...DEFAULT_ADMIN_WORKSPACE_STATE,
        ...(persistedState as Partial<AdminWorkspacePersistedState>),
      }),
    },
  ),
);
