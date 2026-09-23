'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

const MENU_GAP = 8;
const VIEWPORT_GUTTER = 8;
const ESTIMATED_ITEM_HEIGHT = 40;
const MENU_VERTICAL_PADDING = 12;

export interface MenuItem {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface ActionMenuProps {
  items: readonly MenuItem[];
  trigger: ReactNode;
  label?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface MenuPosition {
  top: number;
  left: number;
  opensUpward: boolean;
}

/** Small accessible action menu. The caller owns the actions and navigation. */
export function ActionMenu({ items, trigger, label, align = 'right', className = '' }: ActionMenuProps) {
  const { t } = useAppLocale();
  const resolvedLabel = label ?? t('menu.openActions');
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0, opensUpward: false });
  const rootRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemCount = items.length;

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const estimatedHeight = Math.min(
        itemCount * ESTIMATED_ITEM_HEIGHT + MENU_VERTICAL_PADDING,
        window.innerHeight - VIEWPORT_GUTTER * 2,
      );
      const canOpenBelow = rect.bottom + MENU_GAP + estimatedHeight <= window.innerHeight - VIEWPORT_GUTTER;
      const canOpenAbove = rect.top - MENU_GAP - estimatedHeight >= VIEWPORT_GUTTER;
      const opensUpward = !canOpenBelow && canOpenAbove;

      setMenuPosition({
        top: opensUpward
          ? rect.top - MENU_GAP
          : Math.min(rect.bottom + MENU_GAP, window.innerHeight - VIEWPORT_GUTTER),
        left: align === 'right' ? rect.right : align === 'center' ? rect.left + rect.width / 2 : rect.left,
        opensUpward,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, itemCount, open]);

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={resolvedLabel}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="inline-flex h-auto min-h-0 w-auto items-center justify-center rounded-md border-0 bg-transparent px-1 py-0 text-[0.9em] leading-none text-slate-400 shadow-none transition hover:bg-slate-100 hover:text-indigo-600 focus:border-0 focus:outline-none focus:ring-0"
      >
        {trigger}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            transform: [
              align === 'right' ? 'translateX(-100%)' : align === 'center' ? 'translateX(-50%)' : undefined,
              menuPosition.opensUpward ? 'translateY(-100%)' : undefined,
            ].filter(Boolean).join(' ') || undefined,
          } as CSSProperties}
          className="fixed z-[100] max-h-[calc(100vh-1rem)] min-w-44 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (item.disabled) return;
                setOpen(false);
                item.onSelect();
              }}
              className={`flex min-h-9 w-full items-center rounded-lg px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${item.destructive ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </span>
  );
}

export interface OverflowMenuProps extends Omit<ActionMenuProps, 'trigger'> {
  label?: string;
}

export function OverflowMenu({ label = 'Altre azioni', ...props }: OverflowMenuProps) {
  return <ActionMenu {...props} align="center" label={label} trigger={<span aria-hidden="true" className="font-bold leading-none">⋮</span>} />;
}
