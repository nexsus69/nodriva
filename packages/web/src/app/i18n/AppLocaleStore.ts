"use client";

/** Provides the persistent frontend locale and the shared UI translation lookup. */
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SupportedLocale } from "@dashboard/core";

const MESSAGES: Record<SupportedLocale, Record<string, string>> = {
  en: {
    "admin.panel": "Admin Panel",
    "admin.openMenu": "Open administration menu",
    "admin.overview": "Overview",
    "admin.model": "Model",
    "admin.modelDescription":
      "Define the types and relationships used by the application.",
    "admin.types": "Types",
    "admin.typesDescription": "Manage node and entity type definitions.",
    "admin.access": "Access",
    "admin.accessDescription":
      "Manage identities, roles, and scope assignments.",
    "admin.activity": "Activity",
    "admin.activityDescription":
      "Review audit history and recover deleted resources.",
    "admin.system": "System",
    "admin.systemDescription":
      "Configure runtime capabilities and placement policies.",
    "admin.operationalArea": "Operational area",
    "admin.modelTypes": "Model / Types",
    "admin.typesTitle": "Types",
    "admin.typesPageDescription":
      "Define the node and entity types that shape the operational workspace.",
    "admin.createType": "Create type",
    "admin.nodeTypes": "Node types",
    "admin.entityTypes": "Entity types",
    "admin.searchTypes": "Search types…",
    "admin.refreshTypes": "Refresh types",
    "admin.loading": "Loading…",
    "admin.sortedByName": "Sorted by name",
    "admin.cancel": "Cancel",
    "admin.confirm": "Confirm",
    "admin.discardTitle": "Discard unsaved changes?",
    "admin.discardDescription": "Your changes will be removed from this form.",
    "admin.discardChanges": "Discard changes",
    "admin.keepEditing": "Keep editing",
    "admin.createNodeType": "Create node type",
    "admin.createEntityType": "Create entity type",
    "admin.typeKey": "Type key",
    "admin.typeKeyHelp": "Lowercase letters, numbers, and underscores.",
    "admin.storageTableHelp": "Lowercase letters, numbers, and underscores.",
    "admin.name": "Name",
    "admin.description": "Description",
    "admin.roles": "Roles",
    "admin.rolesDescription": "Manage reusable permission roles.",
    "admin.roleKey": "Role key",
    "admin.roleKeyHelp": "Lowercase letters, numbers, and underscores.",
    "admin.permissions": "Permissions",
    "admin.permissionsDescription": "Select the permissions granted by this role.",
    "admin.createRole": "Create role",
    "admin.noRoles": "No roles found",
    "admin.loadingRoles": "Loading roles…",
    "admin.roleDetail": "Role detail",
    "admin.backToRoles": "Back to roles",
    "admin.systemRoleReadOnly": "System roles are protected and cannot be modified.",
    "admin.roleNotFound": "Role not found.",
    "admin.noDescription": "No description.",
    "admin.saving": "Saving…",
    "admin.savePermissions": "Save permissions",
    "admin.storageTable": "Storage table",
    "admin.active": "Active",
    "admin.disabled": "Disabled",
    "admin.systemType": "System",
    "admin.noTypes": "No types configured",
    "admin.noTypesDescription":
      "Create the first type to define the data model used by the operational workspace.",
    "admin.fields": "Fields",
    "admin.version": "Version",
    "admin.status": "Status",
    "admin.open": "Open →",
    "admin.validationFailed": "The form contains invalid values.",
    "admin.validationGeneral": "General",
    "admin.validationRequired": "This value is required.",
    "admin.validationTooLong": "This value is too long.",
    "admin.validationInvalid": "This value has an invalid format.",
    "admin.validationMin2": "At least 2 characters.",
    "admin.validationMinLength": "At least",
    "admin.validationMaxLength": "At most",
    "admin.validationEmail": "Valid email",
    "admin.validationMin": "Minimum",
    "admin.validationMax": "Maximum",
    "admin.validationStep": "Step",
    "admin.validationMax100": "Maximum 100 characters.",
    "admin.validationMax150": "Maximum 150 characters.",
    "admin.next": "Next",
    "admin.typeBasics": "Type identity",
    "admin.typeBasicsDescription":
      "Define the stable identity shown across the workspace.",
    "admin.typeConfiguration": "Type configuration",
    "admin.typeConfigurationDescription":
      "Review the technical storage configuration before creating the type.",
    "admin.typeStepBasics": "Step 1 of 2 · Identity",
    "admin.typeStepConfiguration": "Step 2 of 2 · Configuration",
    "admin.typeSummary": "Summary",
    "admin.descriptionPlaceholder": "What this type represents",
    "admin.settings": "Settings",
    "admin.saveChanges": "Save changes",
    "admin.fieldKey": "Field key",
    "admin.columnName": "Column name",
    "admin.label": "Label",
    "admin.dataType": "Data type",
    "admin.requiredField": "Required",
    "admin.uniqueField": "Unique",
    "admin.indexedField": "Indexed",
    "admin.fieldDefinition": "Field definition",
    "admin.addField": "Add field",
    "admin.editField": "Edit field",
    "admin.edit": "Edit",
    "admin.delete": "Delete",
    "admin.deleteFieldTitle": "Delete field?",
    "admin.deleteFieldDescription":
      "This action can affect stored data and cannot be undone easily.",
    "admin.retry": "Retry",
    "admin.fieldsDescription":
      "Define the fields and constraints exposed by this type.",
    "admin.moveUp": "Move up",
    "admin.moveDown": "Move down",
    "admin.backToList": "Back to list",
    "admin.defaultValue": "Default value",
    "admin.encryption": "Encryption",
    "admin.plaintext": "Plain text",
    "admin.encrypted": "Encrypted",
    "admin.relationTargetDomain": "Relation target domain",
    "admin.relationTargetType": "Relation target type key",
    "admin.enumMode": "Enum mode",
    "admin.enumStatic": "Static options",
    "admin.enumManaged": "Managed options",
  },
  it: {
    "admin.panel": "Pannello Admin",
    "admin.openMenu": "Apri menu amministrazione",
    "admin.overview": "Panoramica",
    "admin.model": "Modello",
    "admin.modelDescription":
      "Definisci tipi e relazioni usati dall’applicazione.",
    "admin.types": "Tipi",
    "admin.typesDescription":
      "Gestisci le definizioni dei tipi nodo ed entità.",
    "admin.access": "Accessi",
    "admin.accessDescription":
      "Gestisci identità, ruoli e assegnazioni di perimetro.",
    "admin.activity": "Attività",
    "admin.activityDescription": "Consulta audit e recupera risorse eliminate.",
    "admin.system": "Sistema",
    "admin.systemDescription":
      "Configura capacità runtime e policy di posizionamento.",
    "admin.operationalArea": "Area operativa",
    "admin.modelTypes": "Modello / Tipi",
    "admin.typesTitle": "Tipi",
    "admin.typesPageDescription":
      "Definisci i tipi nodo ed entità che strutturano l’area operativa.",
    "admin.createType": "Crea tipo",
    "admin.nodeTypes": "Tipi nodo",
    "admin.entityTypes": "Tipi entità",
    "admin.searchTypes": "Cerca tipi…",
    "admin.refreshTypes": "Aggiorna tipi",
    "admin.loading": "Caricamento…",
    "admin.sortedByName": "Ordinati per nome",
    "admin.cancel": "Annulla",
    "admin.confirm": "Conferma",
    "admin.discardTitle": "Eliminare le modifiche non salvate?",
    "admin.discardDescription":
      "Le modifiche saranno rimosse da questo modulo.",
    "admin.discardChanges": "Elimina modifiche",
    "admin.keepEditing": "Continua a modificare",
    "admin.createNodeType": "Crea tipo nodo",
    "admin.createEntityType": "Crea tipo entità",
    "admin.typeKey": "Chiave tipo",
    "admin.typeKeyHelp": "Lettere minuscole, numeri e underscore.",
    "admin.storageTableHelp": "Lettere minuscole, numeri e underscore.",
    "admin.name": "Nome",
    "admin.description": "Descrizione",
    "admin.roles": "Ruoli",
    "admin.rolesDescription": "Gestisci i ruoli riutilizzabili e i relativi permessi.",
    "admin.roleKey": "Chiave ruolo",
    "admin.roleKeyHelp": "Lettere minuscole, numeri e underscore.",
    "admin.permissions": "Permessi",
    "admin.permissionsDescription": "Seleziona i permessi assegnati a questo ruolo.",
    "admin.createRole": "Crea ruolo",
    "admin.noRoles": "Nessun ruolo trovato",
    "admin.loadingRoles": "Caricamento ruoli…",
    "admin.roleDetail": "Dettaglio ruolo",
    "admin.backToRoles": "Torna ai ruoli",
    "admin.systemRoleReadOnly": "I ruoli di sistema sono protetti e non possono essere modificati.",
    "admin.roleNotFound": "Ruolo non trovato.",
    "admin.noDescription": "Nessuna descrizione.",
    "admin.saving": "Salvataggio…",
    "admin.savePermissions": "Salva permessi",
    "admin.storageTable": "Tabella storage",
    "admin.active": "Attivo",
    "admin.disabled": "Disabilitato",
    "admin.systemType": "Sistema",
    "admin.noTypes": "Nessun tipo configurato",
    "admin.noTypesDescription":
      "Crea il primo tipo per definire il modello dati dell’area operativa.",
    "admin.fields": "Campi",
    "admin.version": "Versione",
    "admin.status": "Stato",
    "admin.open": "Apri →",
    "admin.validationFailed": "Il modulo contiene valori non validi.",
    "admin.validationGeneral": "Generale",
    "admin.validationRequired": "Questo valore è obbligatorio.",
    "admin.validationTooLong": "Questo valore è troppo lungo.",
    "admin.validationInvalid": "Il formato del valore non è valido.",
    "admin.validationMin2": "Almeno 2 caratteri.",
    "admin.validationMinLength": "Almeno",
    "admin.validationMaxLength": "Massimo",
    "admin.validationEmail": "Email valida",
    "admin.validationMin": "Minimo",
    "admin.validationMax": "Massimo",
    "admin.validationStep": "Passo",
    "admin.validationMax100": "Massimo 100 caratteri.",
    "admin.validationMax150": "Massimo 150 caratteri.",
    "admin.next": "Avanti",
    "admin.typeBasics": "Identità del tipo",
    "admin.typeBasicsDescription":
      "Definisci l’identità stabile mostrata nell’area di lavoro.",
    "admin.typeConfiguration": "Configurazione del tipo",
    "admin.typeConfigurationDescription":
      "Verifica la configurazione tecnica prima di creare il tipo.",
    "admin.typeStepBasics": "Passo 1 di 2 · Identità",
    "admin.typeStepConfiguration": "Passo 2 di 2 · Configurazione",
    "admin.typeSummary": "Riepilogo",
    "admin.descriptionPlaceholder": "Cosa rappresenta questo tipo",
    "admin.settings": "Impostazioni",
    "admin.saveChanges": "Salva modifiche",
    "admin.fieldKey": "Chiave campo",
    "admin.columnName": "Nome colonna",
    "admin.label": "Etichetta",
    "admin.dataType": "Tipo dato",
    "admin.requiredField": "Obbligatorio",
    "admin.uniqueField": "Univoco",
    "admin.indexedField": "Indicizzato",
    "admin.fieldDefinition": "Definizione campo",
    "admin.addField": "Aggiungi campo",
    "admin.editField": "Modifica campo",
    "admin.edit": "Modifica",
    "admin.delete": "Elimina",
    "admin.deleteFieldTitle": "Eliminare il campo?",
    "admin.deleteFieldDescription":
      "L’operazione può influire sui dati esistenti e non è facilmente reversibile.",
    "admin.retry": "Riprova",
    "admin.fieldsDescription":
      "Definisci i campi e i vincoli esposti da questo tipo.",
    "admin.moveUp": "Sposta su",
    "admin.moveDown": "Sposta giù",
    "admin.backToList": "Torna alla lista",
    "admin.defaultValue": "Valore predefinito",
    "admin.encryption": "Cifratura",
    "admin.plaintext": "Testo normale",
    "admin.encrypted": "Cifrato",
    "admin.relationTargetDomain": "Dominio relazione",
    "admin.relationTargetType": "Chiave tipo relazione",
    "admin.enumMode": "Modalità enum",
    "admin.enumStatic": "Opzioni statiche",
    "admin.enumManaged": "Opzioni gestite",
  },
};

interface AppLocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}

/** Stores the selected locale and mirrors it to a cookie for future server boundaries. */
export const useAppLocaleStore = create<AppLocaleState>()(
  persist(
    (set) => ({
      locale: "it",
      setLocale: (locale) => {
        if (typeof document !== "undefined")
          document.cookie = `nodriva-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
        set({ locale });
      },
    }),
    { name: "nodriva-locale", storage: createJSONStorage(() => localStorage) },
  ),
);

/** Returns the current locale and a stable translation function for UI components. */
export function useAppLocale() {
  const locale = useAppLocaleStore((state) => state.locale);
  const setLocale = useAppLocaleStore((state) => state.setLocale);
  const t = useCallback(
    (key: string, fallback = key) => MESSAGES[locale][key] ?? fallback,
    [locale],
  );
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);
  return {
    locale,
    setLocale,
    t,
  };
}
