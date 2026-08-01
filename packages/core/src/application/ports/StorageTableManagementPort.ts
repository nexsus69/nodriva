/**
 * Porta per l'esecuzione di comandi DDL (Data Definition Language)
 * sulle tabelle fisiche di storage dedicate alle entità dinamiche.
 *
 * Responsabilità:
 * - Creare la tabella specifica per tipo (es. entity_device).
 * - Aggiungere/modificare/rimuovere colonne tipizzate corrispondenti ai campi.
 * - Gestire vincoli UNIQUE e indici fisici.
 *
 * NOTA: Tutti i metodi operano all'interno della transazione corrente
 * (se avviata tramite PgTransactionContext/TransactionPort).
 */
export interface StorageTableManagementPort {
  /**
   * Crea una nuova tabella fisica di storage per un EntityType.
   * La tabella creata avrà come chiave primaria una colonna entity_id che referenzia
   * la tabella base entities con eliminazione in cascata.
   *
   * @param storageTable Il nome della tabella da creare (es. "entity_device").
   */
  createStorageTable(storageTable: string): Promise<void>;

  /**
   * Aggiunge una nuova colonna fisica alla tabella di storage.
   *
   * @param storageTable Il nome della tabella fisica.
   * @param columnName Il nome della colonna da aggiungere.
   * @param dataType Il tipo di dato logico (es. "string", "number", "boolean", "date", "uuid").
   * @param isRequired Se la colonna deve essere NOT NULL.
   * @param isUnique Se la colonna deve avere un vincolo UNIQUE.
   * @param defaultValueText Il valore di default espresso come testo (opzionale).
   */
  addColumn(
    storageTable: string,
    columnName: string,
    dataType: string,
    isRequired: boolean,
    isUnique: boolean,
    defaultValueText: string | null
  ): Promise<void>;

  /**
   * Modifica la nullabilità (NOT NULL / NULL) di una colonna esistente.
   */
  updateColumnNullability(
    storageTable: string,
    columnName: string,
    isRequired: boolean
  ): Promise<void>;

  /**
   * Modifica il valore di default di una colonna esistente.
   * Se defaultValueText è null, rimuove il default.
   */
  updateColumnDefault(
    storageTable: string,
    columnName: string,
    defaultValueText: string | null
  ): Promise<void>;

  /**
   * Rimuove una colonna fisica dalla tabella di storage.
   * Rimuove automaticamente anche indici e vincoli associati a quella colonna.
   */
  dropColumn(storageTable: string, columnName: string): Promise<void>;

  /**
   * Aggiunge un vincolo di unicità UNIQUE su una colonna.
   */
  createUniqueConstraint(storageTable: string, columnName: string): Promise<void>;

  /**
   * Rimuove un vincolo di unicità UNIQUE da una colonna.
   */
  dropUniqueConstraint(storageTable: string, columnName: string): Promise<void>;

  /**
   * Crea un indice standard B-Tree sulla colonna specificata.
   */
  createIndex(storageTable: string, columnName: string): Promise<void>;

  /**
   * Rimuove un indice sulla colonna specificata.
   */
  dropIndex(storageTable: string, columnName: string): Promise<void>;
}
