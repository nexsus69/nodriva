'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  align?: 'left' | 'right';
  className?: string;
}

/** Small accessible action menu. The caller owns the actions and navigation. */
export function ActionMenu({ items, trigger, label = 'Apri menu azioni', align = 'right', className = '' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
      >
        {trigger}
      </button>
      {open && (
        <div role="menu" className={`absolute z-50 mt-2 min-w-44 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onSelect();
              }}
              className={`flex min-h-9 w-full items-center rounded-lg px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${item.destructive ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface OverflowMenuProps extends Omit<ActionMenuProps, 'trigger'> {
  label?: string;
}

export function OverflowMenu({ label = 'Altre azioni', ...props }: OverflowMenuProps) {
  return <ActionMenu {...props} label={label} trigger={<span aria-hidden="true" className="text-lg font-bold leading-none">⋮</span>} />;
}
