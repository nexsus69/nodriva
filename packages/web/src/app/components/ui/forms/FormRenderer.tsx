import type { FormEvent, ReactNode } from "react";
import { PasswordInput } from "./PasswordInput";
import { AttachmentInput } from "./AttachmentInput";
import { RelationPicker } from "./RelationPicker";
import { CustomSelect } from "./CustomSelect";
import { NodeTreeSelect } from "./NodeTreeSelect";
import type {
  FormDefinition,
  FormFieldLayout,
  FormFieldSchema,
  FormFieldRule,
  FormValidationMessages,
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
  FormNodeTreeLabels,
  FormTreeNodeOption,
  FormValidationMessages,
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
  theme?: "dark" | "light";
  renderFieldAddon?: (field: FormFieldSchema) => ReactNode;
  showActions?: boolean;
  actionPlacement?: "flow" | "sticky";
}

const DEFAULT_VALIDATION_MESSAGES: FormValidationMessages = {
  required: "Required",
  pattern: "Valid format",
  selectPlaceholder: "Select a value",
  minLength: (count) => `At least ${count} characters`,
  maxLength: (count) => `At most ${count} characters`,
  email: "Valid email",
  min: (value) => `Minimum ${value}`,
  max: (value) => `Maximum ${value}`,
  step: (value) => `Step ${value}`,
};

function fieldClassName(theme: "dark" | "light"): string {
  return theme === "light"
    ? "min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    : "min-h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60";
}
const gridColumns: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  6: "grid-cols-1 sm:grid-cols-3 lg:grid-cols-6",
  12: "grid-cols-1 sm:grid-cols-6 lg:grid-cols-12",
};
const gridGaps: Record<string, string> = {
  compact: "gap-2",
  normal: "gap-4",
  spacious: "gap-6",
};

/** Converts a field span into a Tailwind grid column class. */
function columnSpanClass(span: FormFieldLayout["colSpan"]): string {
  const spans: Record<NonNullable<FormFieldLayout["colSpan"]>, string> = {
    1: "col-span-full sm:col-span-1",
    2: "col-span-full sm:col-span-2",
    3: "col-span-full sm:col-span-3",
    4: "col-span-full sm:col-span-4",
    5: "col-span-full sm:col-span-5",
    6: "col-span-full sm:col-span-6",
    7: "col-span-full sm:col-span-6 lg:col-span-7",
    8: "col-span-full sm:col-span-6 lg:col-span-8",
    9: "col-span-full sm:col-span-6 lg:col-span-9",
    10: "col-span-full sm:col-span-6 lg:col-span-10",
    11: "col-span-full sm:col-span-6 lg:col-span-11",
    12: "col-span-full sm:col-span-6 lg:col-span-12",
  };
  return span ? spans[span] : "col-span-full";
}

/** Resolves the label and control wrapper classes for the requested label position. */
function labelLayoutClass(position: FormLabelPosition | undefined): string {
  return position === "inline" ? "flex items-center gap-3" : "block";
}

/** Evaluates a rule; every declared rule is invalid until its requirement is met. */
type ResolvedFormRule = FormFieldRule | { kind: "required"; message: string };

function evaluateRule(rule: ResolvedFormRule, value: unknown): boolean {
  const text = String(value ?? "");
  if (rule.kind === "required") return text.length > 0;
  if (!text) return false;
  switch (rule.kind) {
    case "pattern":
      try {
        return new RegExp(String(rule.value ?? "")).test(text);
      } catch {
        return false;
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
      return false;
  }
}

/** Normalizes shorthand validation into independently renderable requirements. */
function fieldRules(
  field: FormFieldSchema,
  messages: FormValidationMessages,
): ResolvedFormRule[] {
  const validation = field.validation;
  if (!validation)
    return field.required ? [{ kind: "required", message: messages.required }] : [];
  const rules: ResolvedFormRule[] = [];
  if (field.required)
    rules.push({ kind: "required", message: messages.required });
  if (validation.rules) rules.push(...validation.rules);
  if (validation.pattern)
    rules.push({
      kind: "pattern",
      value: validation.pattern,
      message: messages.pattern,
    });
  if (validation.minLength !== undefined)
    rules.push({
      kind: "minLength",
      value: validation.minLength,
      message: messages.minLength(validation.minLength),
    });
  if (validation.maxLength !== undefined)
    rules.push({
      kind: "maxLength",
      value: validation.maxLength,
      message: messages.maxLength(validation.maxLength),
    });
  if (validation.email) rules.push({ kind: "email", message: messages.email });
  if (validation.min !== undefined)
    rules.push({
      kind: "min",
      value: validation.min,
      message: messages.min(validation.min),
    });
  if (validation.max !== undefined)
    rules.push({
      kind: "max",
      value: validation.max,
      message: messages.max(validation.max),
    });
  if (validation.step !== undefined)
    rules.push({
      kind: "step",
      value: validation.step,
      message: messages.step(validation.step),
    });
  return rules;
}

/** Renders one field according to its declared control and visual layout. */
function FormField({
  field,
  value,
  onChange,
  theme,
  validationMessages,
  renderFieldAddon,
}: {
  field: FormFieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  theme: "dark" | "light";
  validationMessages: FormValidationMessages;
  renderFieldAddon?: (field: FormFieldSchema) => ReactNode;
}) {
  const fieldId = `form-field-${field.name}`;
  const labelPosition = field.layout?.labelPosition ?? "top";
  const rules = fieldRules(field, validationMessages);
  const isRequired = Boolean(field.required) ||
    rules.some((rule) => rule.kind === "required");
  if (field.type === "boolean") {
    return (
      <label
        htmlFor={fieldId}
        className={`flex items-center gap-2 pt-2 text-xs ${theme === "light" ? "text-slate-700" : "text-slate-300"} ${field.layout?.className ?? ""}`}
      >
        <input
          id={fieldId}
          name={field.name}
          type="checkbox"
          checked={Boolean(value)}
          disabled={field.disabled}
          onChange={(event) => onChange(event.target.checked)}
          className={`rounded text-indigo-600 focus:ring-indigo-500 ${theme === "light" ? "border-slate-300 bg-white" : "border-slate-800 bg-slate-900"}`}
        />
        <span>
          {field.label}{isRequired ? " *" : ""}
          {field.description && (
            <span className={`ml-2 text-[11px] font-normal ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>
              {field.description}
            </span>
          )}
        </span>
      </label>
    );
  }

  const label =
    labelPosition === "hidden" ? null : (
      <label
        htmlFor={field.type === "attachment" ? undefined : fieldId}
        className={`mb-1.5 block shrink-0 text-xs font-semibold ${theme === "light" ? "text-slate-700" : "text-slate-300"}`}
      >
        {field.label}
        {isRequired ? " *" : ""}
      </label>
    );
  const control =
    field.type === "attachment" ? (
      <AttachmentInput
        kind={field.kind}
        maxFiles={field.maxFiles}
        maxSizeBytes={field.maxSizeBytes}
        acceptedMimeTypes={field.acceptedMimeTypes}
        disabled={field.disabled}
        value={Array.isArray(value) ? (value as File[]) : []}
        onChange={onChange}
      />
    ) : field.type === "relation" ? (
      <RelationPicker
        fieldKey={field.name}
        label={field.label}
        value={value}
        required={isRequired}
        resourceType={field.resourceType}
        typeKey={field.typeKey}
        tone={theme}
        showLabel={false}
        onChange={onChange}
        disabled={field.disabled}
      />
    ) : field.type === "nodeTree" ? (
      <NodeTreeSelect
        id={fieldId}
        name={field.name}
        value={String(value ?? "")}
        nodes={field.nodes}
        labels={field.labels}
        loading={field.loading}
        interaction={field.interaction}
        disabled={field.disabled}
        required={isRequired}
        onChange={(nodeId) => onChange(nodeId)}
      />
  ) : field.type === "select" ? (
      <CustomSelect
        id={fieldId}
        value={String(value ?? "")}
        options={field.options}
        required={isRequired}
        disabled={field.disabled}
        tone={theme}
        placeholder={field.placeholder ?? validationMessages.selectPlaceholder}
        onChange={onChange}
      />
    ) : field.type === "password" ? (
      <PasswordInput
        id={fieldId}
        name={field.name}
        required={isRequired}
        disabled={field.disabled}
        autoComplete={field.autoComplete}
        value={String(value ?? "")}
        onChange={onChange}
        placeholder={field.placeholder}
        className={fieldClassName(theme)}
      />
    ) : field.type === "textarea" ? (
      <textarea
        id={fieldId}
        name={field.name}
        required={isRequired}
        rows={field.rows ?? 3}
        disabled={field.disabled}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName(theme)}
      />
    ) : (
      <input
        id={fieldId}
        name={field.name}
        required={isRequired}
        type={field.type}
        min={field.type === "number" ? field.min : undefined}
        step={field.type === "number" ? field.step : undefined}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        disabled={field.disabled}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName(theme)}
      />
    );
  return (
    <div
      className={`${labelLayoutClass(labelPosition)} ${field.layout?.className ?? ""}`}
    >
      <div>{label}</div>
      {control}
      {field.description && (
        <p className={`mt-1 text-[11px] leading-4 ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>
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
                className={valid ? "text-emerald-600" : "text-rose-600"}
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
      {renderFieldAddon?.(field)}
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
  theme,
  validationMessages,
  renderFieldAddon,
}: {
  fields: readonly FormFieldSchema[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  columns: number;
  gap: string;
  theme: "dark" | "light";
  validationMessages: FormValidationMessages;
  renderFieldAddon?: (field: FormFieldSchema) => ReactNode;
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
            theme={theme}
            validationMessages={validationMessages}
            renderFieldAddon={renderFieldAddon}
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
  theme,
  validationMessages,
  renderFieldAddon,
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
  theme: "dark" | "light";
  validationMessages: FormValidationMessages;
  renderFieldAddon?: (field: FormFieldSchema) => ReactNode;
}) {
  const selected = section?.fieldNames
    ? fields.filter((field) => section.fieldNames?.includes(field.name))
    : fields;
  if (selected.length === 0) return null;
  return (
    <section className={`space-y-4 ${section?.className ?? ""}`}>
      {section?.label && (
        <div className="border-b border-slate-200 pb-3">
          <h3 className={`text-sm font-semibold ${theme === "light" ? "text-slate-900" : "text-slate-200"}`}>
            {section.label}
          </h3>
          {section?.description && (
            <p className={`mt-1 text-xs leading-5 ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>
              {section.description}
            </p>
          )}
        </div>
      )}
      {!section?.label && section?.description && (
        <p className={`mb-4 text-xs ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>
          {section.description}
        </p>
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
            theme={theme}
            validationMessages={validationMessages}
            renderFieldAddon={renderFieldAddon}
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
  theme = "dark",
  renderFieldAddon,
  showActions = true,
  actionPlacement = "flow",
}: FormRendererProps) {
  const resolvedFields = definition?.fields ?? fields ?? [];
  const layout = definition?.layout;
  const validationMessages =
    definition?.validationMessages ?? DEFAULT_VALIDATION_MESSAGES;
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
          theme={theme}
          validationMessages={validationMessages}
          renderFieldAddon={renderFieldAddon}
        />
      ))}
      {unassigned.length > 0 && (
        <FormSection
          fields={unassigned}
          values={values}
          onChange={onChange}
          defaultColumns={layout?.columns ?? 1}
          gap={layout?.gap ?? "normal"}
          theme={theme}
          validationMessages={validationMessages}
          renderFieldAddon={renderFieldAddon}
        />
      )}
      {children}
      {showActions && <div className={`flex items-center justify-end gap-3 border-t pt-4 ${actionPlacement === "sticky" ? "sticky -bottom-6 z-10 -mx-6 -mb-6 mt-6 bg-white px-6 py-4 shadow-[0_-8px_16px_-16px_rgba(15,23,42,0.35)]" : ""} ${theme === "light" ? "border-slate-200" : "border-slate-800/80"}`}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className={`min-h-9 border border-transparent px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${theme === "light" ? "text-slate-600 hover:bg-slate-100" : "text-slate-300 hover:bg-slate-800"}`}
          >
            {cancelLabel ?? "Annulla"}
          </button>
        )}
        <button
          type="submit"
          disabled={isPending || submitDisabled}
          className="min-h-9 border border-violet-600 bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:border-violet-700 hover:bg-violet-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
        >
          {isPending ? pendingLabel : submitLabel}
        </button>
      </div>}
    </form>
  );
}
