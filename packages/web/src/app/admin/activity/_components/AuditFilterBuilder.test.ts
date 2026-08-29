import { describe, expect, it } from "vitest";
import { auditFilterBuilder } from "./AuditFilterBuilder";

const translations: Record<string, string> = {
  "admin.user": "Utente",
  "admin.allUsers": "Tutti gli utenti",
  "admin.action": "Azione",
  "admin.resourceKind": "Risorsa",
  "admin.fromDate": "Da",
  "admin.toDate": "A",
  "admin.auditCatalogLoading": "Catalogo in caricamento",
  "admin.catalog.action.entity.update": "Aggiornamento entità",
  "admin.catalog.word.entity": "Entità",
  "admin.catalog.word.update": "Aggiornamento",
  "admin.catalog.technicalValue": "Valore tecnico: {value}",
};
const t = (key: string, fallback = key) => translations[key] ?? fallback;

describe("auditFilterBuilder", () => {
  it("maps localized labels to the technical values accepted by the server", () => {
    const form = auditFilterBuilder.build({
      t,
      users: [{ id: "user-1", email: "operatore@example.test", isActive: true, isSuperAdmin: false, roles: [], createdAt: "2026-08-29T00:00:00.000Z", updatedAt: "2026-08-29T00:00:00.000Z" }],
      catalog: { actionKeys: ["entity.update"], resourceKinds: ["entity"] },
      values: {},
    });
    const action = form.fields.find((field) => field.name === "actionKey");
    const resource = form.fields.find((field) => field.name === "resourceKind");

    expect(action).toMatchObject({ options: [expect.objectContaining({ value: "entity.update", label: "Aggiornamento entità" })] });
    expect(resource).toMatchObject({ options: [expect.objectContaining({ value: "entity", label: "Entità" })] });
  });

  it("keeps the filters disabled while their authorized catalog is unavailable", () => {
    const form = auditFilterBuilder.build({ t, users: [], catalog: null, values: {} });

    expect(form.fields.find((field) => field.name === "actionKey")).toMatchObject({ disabled: true, description: "Catalogo in caricamento" });
    expect(form.fields.find((field) => field.name === "resourceKind")).toMatchObject({ disabled: true, description: "Catalogo in caricamento" });
  });

  it("retains a historical selected value that is no longer returned by the catalog", () => {
    const form = auditFilterBuilder.build({
      t,
      users: [],
      catalog: { actionKeys: ["entity.update"], resourceKinds: ["entity"] },
      values: { actionKey: "workflow.legacy_action" },
    });
    const action = form.fields.find((field) => field.name === "actionKey");

    expect(action).toMatchObject({ options: expect.arrayContaining([expect.objectContaining({ value: "workflow.legacy_action" })]) });
  });
});
