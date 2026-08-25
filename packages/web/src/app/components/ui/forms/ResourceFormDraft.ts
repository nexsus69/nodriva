/** Routes flat form-renderer values to the canonical resource draft segments. */

/** Describes the separate draft values that a resource editor presents as one form. */
export interface ResourceFormDraftValues {
  typeKey?: string;
  name: string;
  description: string;
  payload: Readonly<Record<string, unknown>>;
  attachments: Readonly<Record<string, readonly File[]>>;
}

/** Provides mutation callbacks for the resource draft segments. */
export interface ResourceFormDraftBindings {
  attachmentFieldKeys: ReadonlySet<string>;
  onTypeKeyChange?: (value: string) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPayloadChange: (fieldKey: string, value: unknown) => void;
  onAttachmentsChange: (fieldKey: string, files: readonly File[]) => void;
}

/** Flattens a draft so FormRenderer can remain independent of resource state storage. */
export function flattenResourceFormDraft(
  values: ResourceFormDraftValues,
): Record<string, unknown> {
  return {
    ...(values.typeKey === undefined ? {} : { typeKey: values.typeKey }),
    name: values.name,
    description: values.description,
    ...values.payload,
    ...values.attachments,
  };
}

/** Routes one shared form change to the appropriate stable or dynamic draft segment. */
export function applyResourceFormDraftChange(
  fieldName: string,
  value: unknown,
  bindings: ResourceFormDraftBindings,
): void {
  if (fieldName === 'typeKey' && bindings.onTypeKeyChange) {
    bindings.onTypeKeyChange(String(value));
    return;
  }
  if (fieldName === 'name') {
    bindings.onNameChange(String(value));
    return;
  }
  if (fieldName === 'description') {
    bindings.onDescriptionChange(String(value));
    return;
  }
  if (bindings.attachmentFieldKeys.has(fieldName)) {
    bindings.onAttachmentsChange(
      fieldName,
      Array.isArray(value) ? value as readonly File[] : [],
    );
    return;
  }
  bindings.onPayloadChange(fieldName, value);
}
