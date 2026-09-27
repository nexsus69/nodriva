'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestConfirmation } from '../components/ui/feedback/ConfirmDialogStore';
import { APP_MESSAGES, useAppLocaleStore } from '../i18n/AppLocaleStore';

/** Creates localized copy for the single application-owned discard confirmation. */
function discardConfirmationOptions() {
  const locale = useAppLocaleStore.getState().locale;
  const messages = APP_MESSAGES[locale];
  return {
    title: messages['admin.discardTitle'] ?? 'Discard unsaved changes?',
    description: messages['admin.discardDescription'] ?? 'Your changes will be removed from this form.',
    confirmLabel: messages['admin.discardChanges'] ?? 'Discard changes',
    cancelLabel: messages['admin.keepEditing'] ?? 'Keep editing',
    tone: 'danger' as const,
  };
}

/** Requests the sole application confirmation used before discarding any dirty form draft. */
export function confirmDiscardFormDraft(): Promise<boolean> {
  return requestConfirmation(discardConfirmationOptions());
}

export class NavigationBlockerRegistry {
  private readonly blockers = new Map<string, (() => void) | undefined>();

  setBlocked(id: string, blocked: boolean, onDiscard?: () => void): boolean {
    const sizeBefore = this.blockers.size;
    if (blocked) this.blockers.set(id, onDiscard);
    else this.blockers.delete(id);
    return sizeBefore !== this.blockers.size;
  }

  get isBlocked(): boolean {
    return this.blockers.size > 0;
  }

  clear(): boolean {
    if (this.blockers.size === 0) return false;
    const discardHandlers = [...this.blockers.values()];
    this.blockers.clear();
    discardHandlers.forEach((onDiscard) => onDiscard?.());
    return true;
  }
}

interface NavigationBlockerContextValue {
  setBlocked: (id: string, blocked: boolean, onDiscard?: () => void) => void;
  confirmNavigation: () => Promise<boolean>;
  requestNavigation: (continueNavigation: () => void) => Promise<boolean>;
  requestHrefNavigation: (href: string) => Promise<boolean>;
}

const NavigationBlockerContext = createContext<NavigationBlockerContextValue | null>(null);
const allowNavigationWithoutProvider = async () => true;
const runNavigationWithoutProvider = async (continueNavigation: () => void) => {
  continueNavigation();
  return true;
};
const navigateHrefWithoutProvider = async (href: string) => {
  window.location.assign(href);
  return true;
};

export function NavigationBlockerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const registry = useRef(new NavigationBlockerRegistry());
  const [, setRevision] = useState(0);

  const setBlocked = useCallback((id: string, blocked: boolean, onDiscard?: () => void) => {
    if (registry.current.setBlocked(id, blocked, onDiscard)) setRevision((current) => current + 1);
  }, []);

  const confirmNavigation = useCallback(async () => {
    if (!registry.current.isBlocked) return true;
    if (!(await confirmDiscardFormDraft())) return false;
    if (registry.current.clear()) setRevision((current) => current + 1);
    return true;
  }, []);

  const requestNavigation = useCallback(async (continueNavigation: () => void) => {
    if (!(await confirmNavigation())) return false;
    continueNavigation();
    return true;
  }, [confirmNavigation]);

  const requestHrefNavigation = useCallback(
    (href: string) => requestNavigation(() => router.push(href)),
    [requestNavigation, router],
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!registry.current.isBlocked) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const value = useMemo(
    () => ({ setBlocked, confirmNavigation, requestNavigation, requestHrefNavigation }),
    [confirmNavigation, requestHrefNavigation, requestNavigation, setBlocked],
  );
  return <NavigationBlockerContext.Provider value={value}>{children}</NavigationBlockerContext.Provider>;
}

export function useUnsavedChanges(isDirty: boolean, onDiscard?: () => void) {
  const context = useContext(NavigationBlockerContext);
  const blockerId = useId();
  if (!context) throw new Error('useUnsavedChanges deve essere usato dentro NavigationBlockerProvider.');

  useEffect(() => {
    context.setBlocked(blockerId, isDirty, onDiscard);
    return () => context.setBlocked(blockerId, false);
  }, [blockerId, context, isDirty, onDiscard]);

  const allowNavigation = useCallback(() => context.setBlocked(blockerId, false), [blockerId, context]);
  const confirmDiscard = useCallback(async () => {
    if (!isDirty) return true;
    const confirmed = await confirmDiscardFormDraft();
    if (confirmed) {
      onDiscard?.();
      context.setBlocked(blockerId, false);
    }
    return confirmed;
  }, [blockerId, context, isDirty, onDiscard]);
  return { confirmDiscard, allowNavigation };
}

export function useNavigationConfirmation() {
  const context = useContext(NavigationBlockerContext);
  return context?.confirmNavigation ?? allowNavigationWithoutProvider;
}

/** Requests confirmed client-side navigation through the global discard policy. */
export function useNavigationRequest() {
  const context = useContext(NavigationBlockerContext);
  return context?.requestNavigation ?? runNavigationWithoutProvider;
}

/** Requests an in-app route transition while preserving the unsaved-work policy. */
export function useHrefNavigationRequest() {
  const context = useContext(NavigationBlockerContext);
  return context?.requestHrefNavigation ?? navigateHrefWithoutProvider;
}
