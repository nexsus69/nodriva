'use client';

import { useState } from 'react';
import { validateAttachmentSelection, type ResourceAttachmentConstraints, type ResourceAttachmentKind } from '@dashboard/core';

export interface AttachmentInputProps extends ResourceAttachmentConstraints {
  kind: ResourceAttachmentKind;
  value?: readonly File[];
  onChange: (files: readonly File[]) => void;
}

export function AttachmentInput({ kind, value = [], onChange, maxFiles, maxSizeBytes, acceptedMimeTypes }: AttachmentInputProps) {
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
        className="block w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100"
      />
      {value.length > 0 && <ul className="text-xs text-slate-400">{value.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>}
      {errors.length > 0 && <ul role="alert" className="space-y-1 text-xs text-red-400">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    </div>
  );
}
