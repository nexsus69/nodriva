"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { FormOption } from "./FormDefinition";

/** Renders a keyboard-accessible select without relying on browser-native UI. */
export function CustomSelect({
  id,
  value,
  options,
  disabled = false,
  required = false,
  tone = "dark",
  placeholder = "Select a value",
  searchable = false,
  searchPlaceholder = "Search options",
  onChange,
}: {
  id: string;
  value: string;
  options: readonly FormOption[];
  disabled?: boolean;
  required?: boolean;
  tone?: "dark" | "light";
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => [option.label, option.description, option.value, ...(option.keywords ?? [])]
      .filter((term): term is string => Boolean(term))
      .some((term) => term.toLocaleLowerCase().includes(normalizedQuery)));
  }, [options, query]);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, visibleOptions.findIndex((option) => option.value === value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);
  const selectedVisibleIndex = visibleOptions.findIndex((option) => option.value === value);
  const resolvedActiveIndex = Math.min(activeIndex, Math.max(0, visibleOptions.length - 1));

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  /** Selects an option and closes the popup. */
  const select = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  /** Handles the complete keyboard interaction for the custom listbox. */
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const start = open ? resolvedActiveIndex : selectedVisibleIndex;
      setActiveIndex(Math.max(0, Math.min(visibleOptions.length - 1, start + direction)));
      setOpen(true);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : Math.max(0, visibleOptions.length - 1));
      setOpen(true);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(Math.max(0, selectedVisibleIndex));
        setOpen(true);
      } else if (visibleOptions[resolvedActiveIndex]) {
        select(visibleOptions[resolvedActiveIndex].value);
      }
    }
  };

  return (
    <div ref={rootRef} className="relative">
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          readOnly
          value={value}
          onChange={() => undefined}
          className="sr-only"
        />
      )}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required}
        disabled={disabled}
        onClick={() => {
          setActiveIndex(Math.max(0, visibleOptions.findIndex((option) => option.value === value)));
          setOpen((current) => !current);
        }}
        onKeyDown={handleKeyDown}
        className={`flex min-h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${tone === "light" ? "border-slate-300 bg-white text-slate-900" : "border-slate-700 bg-slate-900 text-slate-100"}`}
      >
        <span className={selected ? undefined : "text-slate-400"}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
          className={`ml-3 size-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        >
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={id}
          className={`absolute z-50 mt-1 max-h-60 w-full overflow-auto border p-1.5 text-sm shadow-xl shadow-slate-950/10 ${tone === "light" ? "border-slate-200 bg-white" : "border-slate-700 bg-slate-900"}`}
        >
          {searchable && (
            <li className={`sticky top-0 z-10 px-1 pb-1.5 ${tone === "light" ? "bg-white" : "bg-slate-900"}`}>
              <input
                autoFocus
                type="search"
                value={query}
                placeholder={searchPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
                className={`w-full rounded border px-2.5 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 ${tone === "light" ? "border-slate-200 bg-slate-50 text-slate-900" : "border-slate-700 bg-slate-800 text-slate-100"}`}
              />
            </li>
          )}
          <li
            role="option"
            aria-selected={!value}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => select("")}
            className={`cursor-pointer px-3 py-2 ${!value ? "bg-violet-50 font-medium text-violet-700" : "text-slate-400 hover:bg-slate-100/10"}`}
          >
            {placeholder}
          </li>
          {visibleOptions.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(option.value)}
              className={`cursor-pointer px-3 py-2 ${index === resolvedActiveIndex ? "bg-violet-50 font-medium text-violet-700" : tone === "light" ? "text-slate-800 hover:bg-slate-100" : "text-slate-100 hover:bg-slate-800"}`}
            >
              <span className="block">{option.label}</span>
              {option.description && <span className={`mt-0.5 block text-xs font-normal ${tone === "light" ? "text-slate-500" : "text-slate-400"}`}>{option.description}</span>}
            </li>
          ))}
          {visibleOptions.length === 0 && (
            <li className={`px-3 py-2 text-sm ${tone === "light" ? "text-slate-500" : "text-slate-400"}`}>
              {searchPlaceholder}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
