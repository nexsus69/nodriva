import type { FormEvent, ReactNode } from "react";
import { PasswordInput } from "./PasswordInput";
import { AttachmentInput } from "./AttachmentInput";
import type {
  FormDefinition,
  FormFieldLayout,
  FormFieldSchema,
  FormFieldRule,
  FormLabelPosition,
} from "./FormDefinition";

export type {
  FormDefinition,
  FormFieldLayout,
  FormFieldSchema,
  FormLabelPosition,
  FormLayoutDefinition,
  FormOption,
  FormSectionDefinition,
  FormFieldValidation,
  FormFieldRule,
} from "./FormDefinition";

/** Provides the values and callbacks required to render a definition-driven form. */
export interface FormRendererProps {
  fields?: readonly FormFieldSchema[];
  definition?: FormDefinition;
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isPending?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  children?: ReactNode;
}

const fieldClassName =
  "w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500";
const gridColumns: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  6: "grid-cols-6",
  12: "grid-cols-12",
};
const gridGaps: Record<string, string> = {
  compact: "gap-2",
  normal: "gap-4",
  spacious: "gap-6",
};

/** Converts a field span into a Tailwind grid column class. */
function columnSpanClass(span: FormFieldLayout["colSpan"]): string {
  return span ? `col-span-${span}` : "col-span-full";
}

/** Resolves the label and control wrapper classes for the requested label position. */
function labelLayoutClass(position: FormLabelPosition | undefined): string {
  return position === "inline" ? "flex items-center gap-3" : "block";
}

/** Evaluates the serializable rules declared by a field definition. */
function evaluateRule(rule: FormFieldRule, value: unknown): boolean {
  const text = String(value ?? "");
  if (rule.kind === "required") return text.length > 0;
  if (!text) return true;
  switch (rule.kind) {
    case "pattern":
      try {
        return new RegExp(String(rule.value ?? "")).test(text);
      } catch {
        return true;
      }
    case "minLength":
      return text.length >= Number(rule.value);
    case "maxLength":
      return text.length <= Number(rule.value);
    case "email":
      return /^\S+@\S+\.\S+$/.test(text);
    case "min":
      return Number(value) >= Number(rule.value);
    case "max":
      return Number(value) <= Number(rule.value);
    case "step":
      return Number(value) % Number(rule.value) === 0;
    default:
      return true;
  }
}

/** Normalizes shorthand validation into independently renderable requirements. */
function fieldRules(field: FormFieldSchema): FormFieldRule[] {
  const validation = field.validation;
  if (!validation)
    return field.required ? [{ kind: "required", message: "Required" }] : [];
  if (validation.rules) return [...validation.rules];
  const rules: FormFieldRule[] = [];
  if (validation.required || field.required)
    rules.push({ kind: "required", message: "Required" });
  if (validation.pattern)
    rules.push({
      kind: "pattern",
      value: validation.pattern,
      message: "Valid format",
    });
  if (validation.minLength !== undefined)
    rules.push({
      kind: "minLength",
      value: validation.minLength,
      message: `At least ${validation.minLength} characters`,
    });
  if (validation.maxLength !== undefined)
    rules.push({
      kind: "maxLength",
      value: validation.maxLength,
      message: `At most ${validation.maxLength} characters`,
    });
  if (validation.email) rules.push({ kind: "email", message: "Valid email" });
  if (validation.min !== undefined)
    rules.push({
      kind: "min",
      value: validation.min,
      message: `Minimum ${validation.min}`,
    });
  if (validation.max !== undefined)
    rules.push({
      kind: "max",
      value: validation.max,
      message: `Maximum ${validation.max}`,
    });
  if (validation.step !== undefined)
    rules.push({
      kind: "step",
      value: validation.step,
      message: `Step ${validation.step}`,
    });
  return rules;
}

/** Renders one field according to its declared control and visual layout. */
function FormField({
  field,
  value,
  onChange,
}: {
  field: FormFieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const fieldId = `form-field-${field.name}`;
  const labelPosition = field.layout?.labelPosition ?? "top";
  if (field.type === "boolean") {
    return (
      <label
        htmlFor={fieldId}
        className={`flex items-center gap-2 pt-2 text-xs text-slate-300 ${field.layout?.className ?? ""}`}
      >
        <input
          id={fieldId}
          name={field.name}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
        />
        {field.label}
      </label>
    );
  }

  const label =
    labelPosition === "hidden" ? null : (
      <label
        htmlFor={field.type === "attachment" ? undefined : fieldId}
        className="block shrink-0 text-xs font-medium text-slate-300"
      >
        {field.label}
        {field.required ? " *" : ""}
      </label>
    );
  const control =
    field.type === "attachment" ? (
      <AttachmentInput
        kind={field.kind}
        maxFiles={field.maxFiles}
        maxSizeBytes={field.maxSizeBytes}
        acceptedMimeTypes={field.acceptedMimeTypes}
        value={Array.isArray(value) ? (value as File[]) : []}
        onChange={onChange}
      />
    ) : field.type === "select" ? (
      <select
        id={fieldId}
        name={field.name}
        required={field.required}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
      >
        <option value="">Seleziona un valore</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ) : field.type === "password" ? (
      <PasswordInput
        id={fieldId}
        name={field.name}
        required={field.required}
        autoComplete={field.autoComplete}
        value={String(value ?? "")}
        onChange={onChange}
        placeholder={field.placeholder}
      />
    ) : field.type === "textarea" ? (
      <textarea
        id={fieldId}
        name={field.name}
        required={field.required}
        rows={field.rows ?? 3}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
      />
    ) : (
      <input
        id={fieldId}
        name={field.name}
        required={field.required}
        type={field.type}
        min={field.type === "number" ? field.min : undefined}
        step={field.type === "number" ? field.step : undefined}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
      />
    );
  const rules = fieldRules(field);

  return (
    <div
      className={`${labelLayoutClass(labelPosition)} ${field.layout?.className ?? ""}`}
    >
      <div>{label}</div>
      {control}
      {field.description && (
        <p className="mt-1 text-[11px] leading-4 text-slate-400">
          {field.description}
        </p>
      )}
      {rules.length > 0 && (
        <ul
          className="mt-1 space-y-0.5 text-[11px]"
          aria-label="Validation rules"
        >
          {rules.map((rule, index) => {
            const valid = evaluateRule(rule, value);
            return (
              <li
                key={`${rule.kind}-${index}`}
                className={valid ? "text-emerald-400" : "text-rose-400"}
              >
                <span className="mr-1" aria-hidden="true">
                  {valid ? "✓" : "✕"}
                </span>
                <span>{rule.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Groups fields by explicit row while preserving declared order. */
function groupFields(fields: readonly FormFieldSchema[]): FormFieldSchema[][] {
  const groups = new Map<string, FormFieldSchema[]>();
  fields.forEach((field, index) => {
    const row = field.layout?.row ?? `__row_${index}`;
    const current = groups.get(row) ?? [];
    current.push(field);
    groups.set(row, current);
  });
  return [...groups.values()].map((group) =>
    group.sort(
      (left, right) => (left.layout?.order ?? 0) - (right.layout?.order ?? 0),
    ),
  );
}

/** Renders a field group with its own grid columns and spacing. */
function FormFieldGroup({
  fields,
  values,
  onChange,
  columns,
  gap,
}: {
  fields: readonly FormFieldSchema[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  columns: number;
  gap: string;
}) {
  return (
    <div
      className={`grid ${gridColumns[columns] ?? gridColumns[12]} ${gridGaps[gap] ?? gridGaps.normal}`}
    >
      {fields.map((field) => (
        <div
          key={field.name}
          className={columnSpanClass(field.layout?.colSpan)}
        >
          <FormField
            field={field}
            value={values[field.name]}
            onChange={(value) => onChange(field.name, value)}
          />
        </div>
      ))}
    </div>
  );
}

/** Renders all fields in one named section using the shared layout contract. */
function FormSection({
  section,
  fields,
  values,
  onChange,
  defaultColumns,
  gap,
}: {
  section?: {
    label?: string;
    description?: string;
    fieldNames?: readonly string[];
    columns?: number;
    className?: string;
  };
  fields: readonly FormFieldSchema[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  defaultColumns: number;
  gap: string;
}) {
  const selected = section?.fieldNames
    ? fields.filter((field) => section.fieldNames?.includes(field.name))
    : fields;
  if (selected.length === 0) return null;
  return (
    <section className={section?.className}>
      {section?.label && (
        <h3 className="mb-1 text-sm font-semibold text-slate-200">
          {section.label}
        </h3>
      )}
      {section?.description && (
        <p className="mb-4 text-xs text-slate-400">{section.description}</p>
      )}
      <div className="space-y-4">
        {groupFields(selected).map((group, index) => (
          <FormFieldGroup
            key={`${section?.label ?? "default"}-${index}`}
            fields={group}
            values={values}
            onChange={onChange}
            columns={section?.columns ?? defaultColumns}
            gap={gap}
          />
        ))}
      </div>
    </section>
  );
}

/** Renders a form from either a complete definition or the legacy fields array. */
export function FormRenderer({
  fields,
  definition,
  values,
  onChange,
  onSubmit,
  isPending = false,
  submitDisabled = false,
  submitLabel = "Salva",
  pendingLabel = "Salvataggio...",
  cancelLabel,
  onCancel,
  children,
}: FormRendererProps) {
  const resolvedFields = definition?.fields ?? fields ?? [];
  const layout = definition?.layout;
  const sections = definition?.sections ?? [
    { key: "default", fieldNames: resolvedFields.map((field) => field.name) },
  ];
  const assigned = new Set(sections.flatMap((section) => section.fieldNames));
  const unassigned = resolvedFields.filter(
    (field) => !assigned.has(field.name),
  );
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {sections.map((section) => (
        <FormSection
          key={section.key}
          section={section}
          fields={resolvedFields}
          values={values}
          onChange={onChange}
          defaultColumns={layout?.columns ?? 1}
          gap={layout?.gap ?? "normal"}
        />
      ))}
      {unassigned.length > 0 && (
        <FormSection
          fields={unassigned}
          values={values}
          onChange={onChange}
          defaultColumns={layout?.columns ?? 1}
          gap={layout?.gap ?? "normal"}
        />
      )}{" "}
      {children}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {cancelLabel ?? "Annulla"}
          </button>
        )}
        <button
          type="submit"
          disabled={isPending || submitDisabled}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50"
        >
          {isPending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
