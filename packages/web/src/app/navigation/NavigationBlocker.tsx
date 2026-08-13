'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';

export const UNSAVED_CHANGES_MESSAGE = 'Sono presenti modifiche non salvate. Vuoi davvero abbandonare la pagina?';

export class NavigationBlockerRegistry {
  private readonly blockers = new Set<string>();

  setBlocked(id: string, blocked: boolean): boolean {
    const sizeBefore = this.blockers.size;
    if (blocked) this.blockers.add(id);
    else this.blockers.delete(id);
    return sizeBefore !== this.blockers.size;
  }

  get isBlocked(): boolean {
    return this.blockers.size > 0;
  }

  clear(): boolean {
    if (this.blockers.size === 0) return false;
    this.blockers.clear();
    return true;
  }
}

interface NavigationBlockerContextValue {
  setBlocked: (id: string, blocked: boolean) => void;
  confirmNavigation: () => boolean;
}

const NavigationBlockerContext = createContext<NavigationBlockerContextValue | null>(null);
const allowNavigationWithoutProvider = () => true;

export function NavigationBlockerProvider({ children }: { children: React.ReactNode }) {
  const registry = useRef(new NavigationBlockerRegistry());
  const [, setRevision] = useState(0);

  const setBlocked = useCallback((id: string, blocked: boolean) => {
    if (registry.current.setBlocked(id, blocked)) setRevision((current) => current + 1);
  }, []);

  const confirmNavigation = useCallback(() => {
    if (!registry.current.isBlocked) return true;
    if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) return false;
    if (registry.current.clear()) setRevision((current) => current + 1);
    return true;
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!registry.current.isBlocked) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const browserNavigation = (window as Window & { navigation?: EventTarget }).navigation;
    if (!browserNavigation) return;
    const handleNavigate = (event: Event) => {
      const navigationEvent = event as Event & { downloadRequest?: string | null; hashChange?: boolean };
      if (!registry.current.isBlocked || navigationEvent.hashChange || navigationEvent.downloadRequest) return;
      if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        if (event.cancelable) event.preventDefault();
        return;
      }
      if (registry.current.clear()) setRevision((current) => current + 1);
    };
    browserNavigation.addEventListener('navigate', handleNavigate);
    return () => browserNavigation.removeEventListener('navigate', handleNavigate);
  }, []);

  const value = useMemo(() => ({ setBlocked, confirmNavigation }), [confirmNavigation, setBlocked]);
  return <NavigationBlockerContext.Provider value={value}>{children}</NavigationBlockerContext.Provider>;
}

export function useUnsavedChanges(isDirty: boolean) {
  const context = useContext(NavigationBlockerContext);
  const blockerId = useId();
  if (!context) throw new Error('useUnsavedChanges deve essere usato dentro NavigationBlockerProvider.');

  useEffect(() => {
    context.setBlocked(blockerId, isDirty);
    return () => context.setBlocked(blockerId, false);
  }, [blockerId, context, isDirty]);

  const allowNavigation = useCallback(() => context.setBlocked(blockerId, false), [blockerId, context]);
  const confirmDiscard = useCallback(() => (
    !isDirty || window.confirm(UNSAVED_CHANGES_MESSAGE)
  ), [isDirty]);
  return { confirmDiscard, allowNavigation };
}

export function useNavigationConfirmation() {
  const context = useContext(NavigationBlockerContext);
  return context?.confirmNavigation ?? allowNavigationWithoutProvider;
}
