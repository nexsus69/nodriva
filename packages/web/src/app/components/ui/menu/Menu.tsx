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
  align?: 'left' | 'center' | 'right';
  className?: string;
}

/** Small accessible action menu. The caller owns the actions and navigation. */
export function ActionMenu({ items, trigger, label = 'Apri menu azioni', align = 'right', className = '' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

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
    <span ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-auto min-h-0 w-auto items-center justify-center rounded-md border-0 bg-transparent px-1 py-0 text-[0.9em] leading-none text-slate-400 shadow-none transition hover:bg-slate-100 hover:text-indigo-600 focus:border-0 focus:outline-none focus:ring-0"
      >
        {trigger}
      </button>
      {open && (
        <span role="menu" className={`absolute z-50 mt-2 min-w-44 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl ${align === 'right' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'}`}>
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
        </span>
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
