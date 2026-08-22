"use client";

/** Provides the first rebuilt Admin Panel module for managing model types. */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import type {
  ApiErrorResponse,
  TypeKind,
  TypeListItemDto,
} from "@dashboard/core";
import Link from "@/app/components/navigation/GuardedLink";
import {
  Alert,
  EmptyState,
  Skeleton,
  SkeletonState,
  StatusBadge,
} from "@/app/components/ui/feedback";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { AdminSurfaceHost } from "@/adminPanel/components/AdminSurfaceHost";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import {
  FormRenderer,
  type FormDefinition,
  type FormFieldSchema,
} from "@/app/components/ui/forms";
import { TYPE_DETAIL_SURFACE, TypeDetailDrawer } from "./TypeDetailDrawer";
import { CREATE_TYPE_SURFACE } from "./typesSurfaceDefinitions";

type TypeForm = {
  typeKey: string;
  name: string;
  description: string;
  storageTable: string;
};
const EMPTY_TYPE_FORM: TypeForm = {
  typeKey: "",
  name: "",
  description: "",
  storageTable: "",
};

/** Loads and mutates model types through the shared administrative cache client. */
function useTypesModule() {
  const { t } = useAppLocale();
  const [types, setTypes] = useState<readonly TypeListItemDto[]>([]);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const cacheRevision = useSyncExternalStore(
    AppCache.subscribe,
    AppCache.getRevision,
    () => 0,
  );
  const moduleKey = "model.types";
  const moduleState = useAdminWorkspaceStore(
    (state) => state.moduleState[moduleKey],
  );
  const setModuleState = useAdminWorkspaceStore(
    (state) => state.setModuleState,
  );
  const kind: TypeKind = moduleState?.kind === "entity" ? "entity" : "node";
  const search =
    typeof moduleState?.search === "string" ? moduleState.search : "";
  const draftKey = `${moduleKey}:type-create:${kind}`;
  const formSurface = useAdminFormSurface<TypeForm>({
    moduleKey,
    surfaceKey: `type-create:${kind}`,
    surfaceKind: CREATE_TYPE_SURFACE.presentation,
    draftKey,
    formVersion: "1",
    initialValues: EMPTY_TYPE_FORM,
    closePolicy: "discard",
    confirmOnDiscard: true,
    confirmTitle: t("admin.discardTitle"),
    confirmDescription: t("admin.discardDescription"),
    confirmConfirmLabel: t("admin.discardChanges"),
    confirmCancelLabel: t("admin.keepEditing"),
  });
  const form = formSurface.values;

  /** Persists the selected type domain in the common module workspace state. */
  const setKind = useCallback(
    (nextKind: TypeKind) => setModuleState(moduleKey, { kind: nextKind }),
    [setModuleState],
  );

  /** Persists the module filter so a reload returns to the same working set. */
  const setSearch = useCallback(
    (nextSearch: string) => setModuleState(moduleKey, { search: nextSearch }),
    [setModuleState],
  );

  /** Fetches the selected type domain and exposes semantic API errors to the screen. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await AppCache.admin.listTypes(kind);
    if (result.success && result.data) setTypes(result.data);
    else setError(result.error ?? null);
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [cacheRevision, load]);

  /** Opens a fresh creation surface without sharing draft state with another module. */
  const openCreate = useCallback(() => {
    setFormError(null);
    formSurface.open();
  }, [formSurface]);

  /** Closes the creation surface and discards its local draft. */
  const closeCreate = useCallback(() => {
    formSurface.close();
    setFormError(null);
  }, [formSurface]);

  /** Validates and submits a new type using the canonical cache mutation path. */
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      startTransition(async () => {
        const result = await AppCache.admin.createType({
          kind,
          typeKey: form.typeKey.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          storageTable:
            kind === "entity"
              ? form.storageTable.trim() || undefined
              : undefined,
        });
        if (result.success) {
          formSurface.complete();
          await load();
        } else setFormError(result.error ?? null);
      });
    },
    [form, formSurface, kind, load],
  );

  return {
    kind,
    setKind,
    search,
    setSearch,
    types,
    error,
    loading,
    load,
    form,
    setForm: formSurface.setValues,
    modalOpen: formSurface.isOpen,
    openCreate,
    closeCreate,
    formError,
    isPending,
    submit,
  };
}

/** Renders the compact loading state without replacing the module layout. */
function TypeTableSkeleton() {
  const { t } = useAppLocale();
  return (
    <SkeletonState
      label={t("admin.loading")}
      className="divide-y divide-slate-100"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="grid grid-cols-4 gap-4 px-5 py-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </SkeletonState>
  );
}

/** Renders the type collection with stable metadata columns and detail links. */
function TypeTable({
  kind,
  types,
  loading,
  onOpen,
}: {
  kind: TypeKind;
  types: readonly TypeListItemDto[];
  loading: boolean;
  onOpen: (type: TypeListItemDto) => void;
}) {
  const { t } = useAppLocale();
  if (loading) return <TypeTableSkeleton />;
  if (types.length === 0)
    return (
      <EmptyState
        title={t("admin.noTypes")}
        description={t("admin.noTypesDescription")}
      />
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">{t("admin.name")}</th>
            <th className="px-5 py-3">{t("admin.typeKey")}</th>
            {kind === "entity" && (
              <th className="px-5 py-3">{t("admin.storageTable")}</th>
            )}
            <th className="px-5 py-3">{t("admin.fields")}</th>
            <th className="px-5 py-3">{t("admin.version")}</th>
            <th className="px-5 py-3">{t("admin.status")}</th>
            <th className="px-5 py-3 text-right"> </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {types.map((type) => (
            <tr key={type.id} className="transition hover:bg-slate-50">
              <td className="px-5 py-4">
                <p className="font-semibold text-slate-800">
                  {type.name}
                  {type.isSystem && (
                    <span className="ml-2">
                      <StatusBadge tone="warning">
                        {t("admin.system")}
                      </StatusBadge>
                    </span>
                  )}
                </p>
                {type.description && (
                  <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                    {type.description}
                  </p>
                )}
              </td>
              <td className="px-5 py-4 font-mono text-xs text-indigo-600">
                {type.typeKey}
              </td>
              {kind === "entity" && (
                <td className="px-5 py-4 font-mono text-xs text-slate-500">
                  {type.storageTable ?? "—"}
                </td>
              )}
              <td className="px-5 py-4 text-slate-600">{type.fieldCount}</td>
              <td className="px-5 py-4 font-mono text-xs text-slate-500">
                schema {type.currentSchemaVersion} · row {type.rowVersion}
              </td>
              <td className="px-5 py-4">
                <StatusBadge tone={type.isActive ? "success" : "danger"}>
                  {type.isActive ? t("admin.active") : t("admin.disabled")}
                </StatusBadge>
              </td>
              <td className="px-5 py-4 text-right">
                <Link
                  href={`/admin/types/${kind}/${type.typeKey}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpen(type);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {t("admin.open")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Builds the visual contract for creating either a node or an entity type. */
function buildTypeFormDefinition(
  kind: TypeKind,
  t: (key: string) => string,
  step: "basics" | "configuration",
): FormDefinition {
  const identityFields: FormFieldSchema[] = [
    {
      name: "typeKey",
      type: "text",
      label: t("admin.typeKey"),
      description: t("admin.typeKeyHelp"),
      required: true,
      placeholder: "project_task",
      layout: { row: "identity", colSpan: 1, order: 1 },
      validation: {
        rules: [
          { kind: "required", message: t("admin.validationRequired") },
          {
            kind: "pattern",
            value: "^[a-z][a-z0-9_]*$",
            message: t("admin.typeKeyHelp"),
          },
          {
            kind: "maxLength",
            value: 100,
            message: t("admin.validationMax100"),
          },
        ],
      },
    },
    {
      name: "name",
      type: "text",
      label: t("admin.name"),
      required: true,
      placeholder: "Project task",
      layout: { row: "identity", colSpan: 1, order: 2 },
      validation: {
        rules: [{ kind: "required", message: t("admin.validationRequired") }],
      },
    },
    {
      name: "description",
      type: "textarea",
      label: t("admin.description"),
      placeholder: t("admin.descriptionPlaceholder"),
      rows: 4,
      layout: { row: "identity", colSpan: 2, order: 3 },
    },
  ];
  if (step === "basics") {
    return {
      key: `admin.types.create.${kind}.basics`,
      version: "1",
      layout: { columns: 2, gap: "normal" },
      sections: [
        {
          key: "identity",
          label: t("admin.typeBasics"),
          description: t("admin.typeBasicsDescription"),
          fieldNames: identityFields.map((field) => field.name),
          columns: 2,
        },
      ],
      fields: identityFields,
    };
  }
  const fields: FormFieldSchema[] = [
    ...(kind === "entity"
      ? [
          {
            name: "storageTable",
            type: "text" as const,
            label: t("admin.storageTable"),
            description: t("admin.storageTableHelp"),
            validation: {
              rules: [
                { kind: "required", message: t("admin.validationRequired") },
                {
                  kind: "pattern",
                  value: "^[a-z][a-z0-9_]*$",
                  message: t("admin.storageTableHelp"),
                },
                {
                  kind: "maxLength",
                  value: 150,
                  message: t("admin.validationMax150"),
                },
              ] as const,
            },
            required: true,
            placeholder: "entity_project_task",
            layout: { row: "configuration", colSpan: 2, order: 1 } as const,
          },
        ]
      : []),
  ];

  return {
    key: `admin.types.create.${kind}.configuration`,
    version: "1",
    layout: { columns: 2, gap: "normal" },
    sections: [
      {
        key: "configuration",
        label: t("admin.typeConfiguration"),
        description: t("admin.typeConfigurationDescription"),
        fieldNames: fields.map((field) => field.name),
        columns: 2,
      },
    ],
    fields,
  };
}

/** Maps validation fields to the labels visible in the current locale. */
function fieldLabel(
  field: string | undefined,
  t: (key: string) => string,
): string {
  if (!field || field === "root") return t("admin.validationGeneral");
  const labels: Record<string, string> = {
    typeKey: t("admin.typeKey"),
    name: t("admin.name"),
    description: t("admin.description"),
    storageTable: t("admin.storageTable"),
  };
  return labels[field] ?? field;
}

/** Translates the common Zod validation messages returned by the backend. */
function validationDetail(message: string, t: (key: string) => string): string {
  if (message.includes("at least 1")) return t("admin.validationRequired");
  if (message.includes("at most")) return t("admin.validationTooLong");
  if (message.includes("Invalid") || message.includes("invalid")) {
    return t("admin.validationInvalid");
  }
  return message;
}

/** Presents a localized summary while retaining the backend error for diagnostics. */
function validationSummary(
  error: ApiErrorResponse,
  t: (key: string) => string,
): string {
  return error.code === "VALIDATION_ERROR"
    ? t("admin.validationFailed")
    : error.message;
}

/** Renders the focused creation drawer from the shared form definition engine. */
function CreateTypeDrawer({
  kind,
  form,
  setForm,
  error,
  pending,
  onClose,
  onSubmit,
}: {
  kind: TypeKind;
  form: TypeForm;
  setForm: Dispatch<SetStateAction<TypeForm>>;
  error: ApiErrorResponse | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useAppLocale();
  const [step, setStep] = useState<"basics" | "configuration">("basics");
  const definition = useMemo(
    () => buildTypeFormDefinition(kind, t, step),
    [kind, step, t],
  );
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (step === "basics") {
      event.preventDefault();
      setStep("configuration");
      return;
    }
    onSubmit(event);
  };

  return (
    <AdminSurfaceHost
      definition={CREATE_TYPE_SURFACE}
      onClose={onClose}
      labelledBy="create-type-title"
    >
      <div className="p-0">
        <div className="flex items-start justify-between border-b border-slate-800 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-400">
              {t("admin.modelTypes")}
            </p>
            <h2
              id="create-type-title"
              className="mt-2 text-xl font-semibold text-white"
            >
              {kind === "node"
                ? t("admin.createNodeType")
                : t("admin.createEntityType")}
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              {step === "basics"
                ? t("admin.typeStepBasics")
                : t("admin.typeStepConfiguration")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("admin.cancel")}
            className="text-xl text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
        {error && (
          <Alert tone="danger" className="mt-5">
            <div className="space-y-2">
              <p>{validationSummary(error, t)}</p>
              {error.details && error.details.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs">
                  {error.details.map((detail, index) => (
                    <li key={`${detail.field ?? "root"}-${index}`}>
                      {fieldLabel(detail.field, t)}:{" "}
                      {validationDetail(detail.message, t)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Alert>
        )}
        <div className="mt-6">
          {step === "configuration" && (
            <div className="mb-5 border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
              <p className="font-semibold text-slate-100">
                {t("admin.typeSummary")}
              </p>
              <p className="mt-2">
                <span className="text-slate-500">{t("admin.typeKey")}:</span>{" "}
                {String(form.typeKey || "—")}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">{t("admin.name")}:</span>{" "}
                {String(form.name || "—")}
              </p>
            </div>
          )}
          <FormRenderer
            definition={definition}
            values={{ ...form }}
            onChange={(name, value) =>
              setForm((current) => ({ ...current, [name]: value }))
            }
            onSubmit={handleSubmit}
            isPending={pending}
            submitLabel={
              step === "basics" ? t("admin.next") : t("admin.createType")
            }
            pendingLabel={t("admin.loading")}
            cancelLabel={t("admin.cancel")}
            onCancel={onClose}
          />
        </div>
      </div>
    </AdminSurfaceHost>
  );
}

/** Composes the first functional model module inside the rebuilt Admin Panel shell. */
export default function AdminTypesPage() {
  const controller = useTypesModule();
  const { t } = useAppLocale();
  const selectedResource = useAdminWorkspaceStore(
    (state) => state.selectedResource,
  );
  const selectResource = useAdminWorkspaceStore(
    (state) => state.selectResource,
  );
  const filteredTypes = useMemo(() => {
    const needle = controller.search.trim().toLowerCase();
    if (!needle) return controller.types;
    return controller.types.filter((type) =>
      [
        type.name,
        type.typeKey,
        type.description ?? "",
        type.storageTable ?? "",
      ].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [controller.search, controller.types]);
  const countLabel = useMemo(
    () =>
      `${filteredTypes.length} of ${controller.types.length} ${controller.kind} ${controller.types.length === 1 ? "type" : "types"}`,
    [controller.kind, controller.types.length, filteredTypes.length],
  );
  const selectedTypeResource =
    selectedResource?.moduleKey === "model.types" && selectedResource.resourceId
      ? selectedResource.resourceId.split(":")
      : null;
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            {t("admin.modelTypes")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {t("admin.typesTitle")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {t("admin.typesPageDescription")}
          </p>
        </div>
        <button
          type="button"
          onClick={controller.openCreate}
          className="bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          {t("admin.createType")}
        </button>
      </header>
      {selectedTypeResource ? (
        <TypeDetailDrawer
          kind={selectedTypeResource[0] as TypeKind}
          typeKey={selectedTypeResource.slice(1).join(":")}
          presentation={TYPE_DETAIL_SURFACE.presentation}
          onClose={() => selectResource(null)}
        />
      ) : (
        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 bg-slate-100 p-1">
              {(["node", "entity"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    controller.setKind(value);
                    controller.setSearch("");
                  }}
                  className={`px-4 py-2 text-xs font-semibold transition ${controller.kind === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {value === "node"
                    ? t("admin.nodeTypes")
                    : t("admin.entityTypes")}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="relative">
                <span className="sr-only">{t("admin.searchTypes")}</span>
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  ⌕
                </span>
                <input
                  value={controller.search}
                  onChange={(event) => controller.setSearch(event.target.value)}
                  placeholder={t("admin.searchTypes")}
                  className="w-full border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:bg-white sm:w-56"
                />
              </label>
              <button
                type="button"
                onClick={() => void controller.load()}
                className="border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                aria-label={t("admin.refreshTypes")}
              >
                ↻
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <span className="text-xs text-slate-500">
              {controller.loading ? t("admin.loading") : countLabel}
            </span>
            <span className="text-[11px] text-slate-400">
              {t("admin.sortedByName")}
            </span>
          </div>
          {controller.error && (
            <div className="p-4">
              <Alert tone="danger">
                <div className="flex items-center justify-between gap-4">
                  <span>{controller.error.message}</span>
                  <button
                    type="button"
                    onClick={() => void controller.load()}
                    className="shrink-0 font-semibold underline"
                  >
                    {t("admin.retry")}
                  </button>
                </div>
              </Alert>
            </div>
          )}
          <TypeTable
            kind={controller.kind}
            types={filteredTypes}
            loading={controller.loading}
            onOpen={(type) =>
              selectResource({
                moduleKey: "model.types",
                resourceId: `${type.kind}:${type.typeKey}`,
              })
            }
          />
        </section>
      )}
      {controller.modalOpen && (
        <CreateTypeDrawer
          kind={controller.kind}
          form={controller.form}
          setForm={controller.setForm}
          error={controller.formError}
          pending={controller.isPending}
          onClose={controller.closeCreate}
          onSubmit={controller.submit}
        />
      )}
    </div>
  );
}
