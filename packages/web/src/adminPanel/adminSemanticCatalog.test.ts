/** Verifies localized labels and legacy fallbacks for finite Admin catalogues. */
import { describe, expect, it } from "vitest";
import type { PermissionDto, RuntimeCapabilityDto, SystemSettingDto } from "@dashboard/core";
import { APP_MESSAGES } from "@/app/i18n/AppLocaleStore";
import {
  fieldDataTypeOption,
  permissionSemanticEntry,
  runtimeCapabilitySemanticEntry,
  systemSettingSemanticEntry,
} from "./adminSemanticCatalog";

function translate(locale: "en" | "it") {
  return (key: string, fallback = key) => APP_MESSAGES[locale][key] ?? fallback;
}

const capability: RuntimeCapabilityDto = {
  id: "capability-1",
  capabilityKey: "realtime",
  name: "Realtime Synchronization",
  description: "Realtime synchronization",
  defaultStatus: "enabled",
  currentStatus: "enabled",
  isSystem: true,
  updatedAt: "2026-08-30T00:00:00.000Z",
};

const setting: SystemSettingDto = {
  id: "setting-1",
  category: "governance",
  settingKey: "audit.recordLockLifecycle",
  displayName: "Record ordinary lock activity",
  description: "Record lock acquisition and ordinary release events.",
  valueType: "boolean",
  valueText: "true",
  isSecret: false,
  isSystem: true,
  rowVersion: 1,
  updatedAt: "2026-08-30T00:00:00.000Z",
};

const permission: PermissionDto = {
  id: "permission-1",
  permissionKey: "node.read",
  name: "node.read",
  description: "Allow node.read",
  resourceKind: "node",
};

describe("admin semantic catalogues", () => {
  it("maps a localized field-data-type label to its unchanged technical value", () => {
    expect(fieldDataTypeOption("datetime", translate("en"))).toMatchObject({
      value: "datetime",
      label: "Date and time",
    });
    expect(fieldDataTypeOption("datetime", translate("it"))).toMatchObject({
      value: "datetime",
      label: "Data e ora",
    });
  });

  it("localizes known system and permission catalogues in both supported languages", () => {
    expect(runtimeCapabilitySemanticEntry(capability, translate("it"))).toMatchObject({
      label: "Sincronizzazione realtime",
    });
    expect(systemSettingSemanticEntry(setting, translate("it"))).toMatchObject({
      label: "Registra attività lock ordinaria",
    });
    expect(permissionSemanticEntry(permission, translate("it"))).toMatchObject({
      label: "Nodo · Lettura",
      description: "Valore tecnico: node.read",
    });
    expect(permissionSemanticEntry(permission, translate("en"))).toMatchObject({
      label: "Node · Read",
      description: "Technical value: node.read",
    });
  });

  it("keeps a historical setting visible when it has no local catalogue entry", () => {
    expect(systemSettingSemanticEntry({
      ...setting,
      settingKey: "legacy.externalFlag",
      displayName: "Legacy external flag",
      description: "Provided by a legacy integration.",
    }, translate("it"))).toMatchObject({
      label: "Legacy external flag",
      description: "Provided by a legacy integration.",
    });
  });
});
