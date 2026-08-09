'use client';

import { useState } from 'react';

export interface PasswordInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
}

export function PasswordInput({ id, name, value, onChange, required, minLength, maxLength, autoComplete, placeholder, className = 'w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 pr-10 text-xs text-slate-100 focus:outline-none focus:border-indigo-500' }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><input id={id} name={name} type={visible ? 'text' : 'password'} required={required} minLength={minLength} maxLength={maxLength} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={className} /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Nascondi password' : 'Mostra password'} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-200"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">{visible ? <><path d="M3 3l18 18" /><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" /><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 9.5 6a16 16 0 0 1-3.2 3.8M6.2 6.2C3.9 7.7 2.7 9.6 2.5 10c1 2 4.5 6 9.5 6 1 0 2-.2 2.8-.5" /></> : <><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>}</svg></button></div>;
}
