"use client";

/** Provides the first rebuilt Admin Panel module for managing model types. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorResponse,
  TypeKind,
  TypeListItemDto,
} from "@dashboard/core";
import {
  Alert,
  StatusBadge,
} from "@/app/components/ui/feedback";
import { AppCache } from "@/app/cache/GlobalCacheClient";
import { useAdminWorkspaceStore } from "@/adminPanel/AdminWorkspaceStore";
import { refreshAdminCollection } from "@/adminPanel/refreshAdminCollection";
import { useAdminFormSurface } from "@/adminPanel/useAdminFormSurface";
import { AdminSurfaceHost } from "@/adminPanel/components/AdminSurfaceHost";
import { useAppLocale } from "@/app/i18n/AppLocaleStore";
import {
  FormRenderer,
  createValidationMessages,
  type FormDefinition,
  type FormFieldSchema,
} from "@/app/components/ui/forms";
import { CREATE_TYPE_SURFACE } from "./typesSurfaceDefinitions";
import { useAdminAuthorization } from "@/adminPanel/AdminAuthorizationContext";
import { AdminSurfaceHeader } from "@/adminPanel/components/AdminSurfaceHeader";
import { AdminCollectionScreen, type AdminCollectionDefinition } from "@/adminPanel/components/AdminCollectionScreen";
import { useAdminRealtimeCollectionRefresh } from "@/adminPanel/useAdminRealtimeCollectionRefresh";
import { useAdminRemotePagination } from "@/adminPanel/useAdminRemotePagination";
import type { AdminTableSortState } from "@/adminPanel/components/AdminTable";
import { ADMIN_THEME } from "@/Theme";
import { localizeApiError, localizeApiErrorDetail } from "@/app/errors/localizeApiError";

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
const TYPE_REALTIME_DEPENDENCIES = ["admin-types-page", "types", "type-detail", "type-definition"] as const;

/** Loads and mutates model types through the shared administrative cache client. */
function useTypesModule() {
  const [types, setTypes] = useState<readonly TypeListItemDto[]>([]);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<AdminTableSortState | null>(null);
  const [formError, setFormError] = useState<ApiErrorResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const loadVersion = useRef(0);
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
  const pagination = useAdminRemotePagination({ total, stateKey: `model.types.${kind}` });
  const createStep: "basics" | "configuration" = moduleState?.createStep === "configuration"
    ? "configuration"
    : "basics";
  const draftKey = `${moduleKey}:type-create:${kind}`;
  const formSurface = useAdminFormSurface<TypeForm>({
    moduleKey,
    surfaceKey: `type-create:${kind}`,
    surfaceKind: CREATE_TYPE_SURFACE.presentation,
    draftKey,
    formVersion: "1",
    initialValues: EMPTY_TYPE_FORM,
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
  const load = useCallback(async (requestedPage = pagination.page) => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    const acceptedSort = sort && ["name", "typeKey", "fields", "version"].includes(sort.columnKey)
      ? { key: sort.columnKey as "name" | "typeKey" | "fields" | "version", direction: sort.direction }
      : undefined;
    try {
      const result = await AppCache.adminTypes.read(kind, {
        page: requestedPage,
        pageSize: pagination.pageSize,
        search: search.trim() || undefined,
        sort: acceptedSort,
      });
      if (version !== loadVersion.current) return;
      setTypes(result.items);
      setTotal(result.total);
      pagination.setPage(result.page);
    } catch (cause) {
      if (version === loadVersion.current) setError(cause as ApiErrorResponse);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [kind, pagination, search, sort]);
  const refresh = useCallback(
    async () => refreshAdminCollection(load),
    [load],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useAdminRealtimeCollectionRefresh(TYPE_REALTIME_DEPENDENCIES, () => load(pagination.page));

  /** Opens a fresh creation surface without sharing draft state with another module. */
  const openCreate = useCallback(() => {
    setFormError(null);
    formSurface.open();
  }, [formSurface]);

  /** Closes the creation surface and discards its local draft. */
  const closeCreate = useCallback(async () => {
    if (await formSurface.close()) {
      setFormError(null);
      setModuleState(moduleKey, { createStep: "basics" });
    }
  }, [formSurface, setModuleState]);

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
          setModuleState(moduleKey, { createStep: "basics" });
          await load();
        } else setFormError(result.error ?? null);
      });
    },
    [form, formSurface, kind, load, setModuleState],
  );

  return {
    kind,
    setKind,
    search,
    setSearch,
    types,
    total,
    error,
    loading,
    load,
    refresh,
    pagination,
    sort,
    setSort,
    loadPage: (page: number) => void load(page),
    form,
    setForm: formSurface.setValues,
    modalOpen: formSurface.isOpen,
    openCreate,
    closeCreate,
    formError,
    isPending,
    submit,
    createStep,
    setCreateStep: (step: "basics" | "configuration") =>
      setModuleState(moduleKey, { createStep: step }),
  };
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
        rules: [{
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
      placeholder: t("admin.typeNamePlaceholder"),
      layout: { row: "identity", colSpan: 1, order: 2 },
        validation: {},
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
      validationMessages: createValidationMessages(t),
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
              rules: [{
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
      validationMessages: createValidationMessages(t),
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
  return localizeApiErrorDetail({ code: "VALIDATION_FAILED", message }, t);
}

/** Presents a localized summary while retaining the backend error for diagnostics. */
function validationSummary(
  error: ApiErrorResponse,
  t: (key: string) => string,
): string {
  return error.code === "VALIDATION_ERROR"
    ? t("admin.validationFailed")
    : localizeApiError(error, t);
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
  step,
  onStepChange,
}: {
  kind: TypeKind;
  form: TypeForm;
  setForm: Dispatch<SetStateAction<TypeForm>>;
  error: ApiErrorResponse | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  step: "basics" | "configuration";
  onStepChange: (step: "basics" | "configuration") => void;
}) {
  const { t } = useAppLocale();
  const definition = useMemo(
    () => buildTypeFormDefinition(kind, t, step),
    [kind, step, t],
  );
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (step === "basics") {
      event.preventDefault();
      onStepChange("configuration");
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
        <AdminSurfaceHeader
          title={kind === "node"
            ? t("admin.createNodeType")
            : t("admin.createEntityType")}
          titleId="create-type-title"
          eyebrow={t("admin.modelTypes")}
          subtitle={step === "basics"
            ? t("admin.typeStepBasics")
            : t("admin.typeStepConfiguration")}
          closeLabel={t("admin.cancel")}
          onClose={onClose}
          appearance={ADMIN_THEME.appearance}
        />
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
        <div className="p-6">
          {step === "configuration" && (
            <div className="mb-5 border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">
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
            theme={ADMIN_THEME.form}
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
  const router = useRouter();
  const { t } = useAppLocale();
  const authorization = useAdminAuthorization();
  const canCreate = authorization.permissions.has(`${controller.kind}_type.create`);
  const countLabel = useMemo(
    () =>
      t("admin.typeCount")
        .replace("{visible}", String(controller.types.length))
        .replace("{total}", String(controller.total)),
    [controller.total, controller.types.length, t],
  );
  const definition: AdminCollectionDefinition<TypeListItemDto> = {
    title: t("admin.typesTitle"),
    description: t("admin.typesPageDescription"),
    icon: "schema",
    breadcrumbs: [{ label: t("admin.model") }],
    createLabel: controller.kind === "node" ? t("admin.createNodeType") : t("admin.createEntityType"),
    onCreate: canCreate ? controller.openCreate : undefined,
    columns: [
      { key: "name", label: t("admin.name"), render: (type) => <div><p className="font-semibold text-slate-800">{type.name}{type.isSystem && <span className="ml-2"><StatusBadge tone="warning">{t("admin.system")}</StatusBadge></span>}</p>{type.description && <p className="mt-1 max-w-xs truncate text-xs text-slate-500">{type.description}</p>}</div>, sortValue: (type) => type.name },
      { key: "typeKey", label: t("admin.typeKey"), render: (type) => type.typeKey, sortValue: (type) => type.typeKey },
      ...(controller.kind === "entity" ? [{ key: "storage", label: t("admin.storageTable"), render: (type: TypeListItemDto) => type.storageTable ?? "—", sortValue: (type: TypeListItemDto) => type.storageTable }] : []),
      { key: "fields", label: t("admin.fields"), render: (type) => type.fieldCount, sortValue: (type) => type.fieldCount },
      { key: "version", label: t("admin.version"), render: (type) => <div className="text-xs leading-5"><div><span className="text-slate-500">{t("admin.schemaVersion")}:</span> {type.currentSchemaVersion}</div><div><span className="text-slate-500">{t("admin.recordRevision")}:</span> {type.rowVersion}</div></div>, sortValue: (type) => type.currentSchemaVersion },
      { key: "status", label: t("admin.status"), render: (type) => <StatusBadge tone={type.isActive ? "success" : "danger"}>{type.isActive ? t("admin.active") : t("admin.disabled")}</StatusBadge> },
    ],
    emptyLabel: t("admin.noTypes"),
    loadingLabel: t("admin.loading"),
    error: controller.error ? new Error(controller.error.message) : null,
    loading: controller.loading,
    rows: controller.types,
    search: { value: controller.search, label: t("admin.searchTypes"), placeholder: t("admin.searchTypes"), onChange: controller.setSearch },
    resultLabel: controller.loading ? t("admin.loading") : countLabel,
    refreshLabel: t("admin.refreshTypes"),
    onRefresh: () => void controller.refresh(),
    toolbar: <div className="flex gap-1 bg-slate-100 p-1">{(["node", "entity"] as const).map((value) => <button key={value} type="button" onClick={() => { controller.setKind(value); controller.setSearch(""); }} className={`px-4 py-2 text-xs font-semibold transition ${controller.kind === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{value === "node" ? t("admin.nodeTypes") : t("admin.entityTypes")}</button>)}</div>,
    onOpen: (type) => router.push(`/admin/model/types/${type.kind}/${encodeURIComponent(type.typeKey)}`),
    rowLabel: (type) => type.name,
    actionMenuLabel: t("admin.actions"),
    pagination: { mode: "remote", page: controller.pagination.page, pageCount: controller.pagination.pageCount, onPageChange: controller.loadPage, sort: controller.sort, onSortChange: controller.setSort },
  };
  return (
    <>
      <AdminCollectionScreen definition={definition} />
      {controller.modalOpen && (
        <CreateTypeDrawer
          kind={controller.kind}
          form={controller.form}
          setForm={controller.setForm}
          error={controller.formError}
          pending={controller.isPending}
          onClose={controller.closeCreate}
          onSubmit={controller.submit}
          step={controller.createStep}
          onStepChange={controller.setCreateStep}
        />
      )}
    </>
  );
}
