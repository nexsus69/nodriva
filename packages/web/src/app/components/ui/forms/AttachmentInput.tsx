'use client';

import { useState } from 'react';
import { validateAttachmentSelection, type ResourceAttachmentConstraints, type ResourceAttachmentKind } from '@dashboard/core/browser';

export interface AttachmentInputProps extends ResourceAttachmentConstraints {
  kind: ResourceAttachmentKind;
  tone?: 'dark' | 'light';
  value?: readonly File[];
  onChange: (files: readonly File[]) => void;
}

export function AttachmentInput({ kind, tone = 'dark', value = [], onChange, maxFiles, maxSizeBytes, acceptedMimeTypes }: AttachmentInputProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const multiple = maxFiles === undefined || maxFiles > 1;
  const accept = acceptedMimeTypes?.join(',') ?? (kind === 'image' ? 'image/*' : undefined);

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          const nextErrors = validateAttachmentSelection(files, { maxFiles, maxSizeBytes, acceptedMimeTypes });
          setErrors(nextErrors);
          if (nextErrors.length === 0) onChange(files);
        }}
        className={`block w-full rounded-lg border px-3 py-2 text-xs ${tone === 'light' ? 'border-slate-200 bg-slate-50 text-slate-700 file:text-slate-700' : 'border-slate-800 bg-slate-900 text-slate-100 file:text-slate-200'}`}
      />
      {value.length > 0 && <ul className={`text-xs ${tone === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{value.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>}
      {errors.length > 0 && <ul role="alert" className="space-y-1 text-xs text-red-400">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    </div>
  );
}
