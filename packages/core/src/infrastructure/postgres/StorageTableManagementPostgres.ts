import { StorageTableManagementPort } from '../../application/ports/StorageTableManagementPort.js';
import { UnsupportedFieldDataTypeError } from '../../domain/errors/SchemaErrors.js';
import { PgExecutor } from './PgExecutor.js';

/**
 * Adapter PostgreSQL per la gestione fisica (DDL) delle storage tables delle entità.
 *
 * Mappa i tipi logici ai tipi PostgreSQL nativi ed esegue i comandi DDL tramite PgExecutor.
 * Tutti gli identificatori (tabelle, colonne, indici, vincoli) sono escaped in modo sicuro
 * usando double quoting per prevenire SQL injection.
 */
export class StorageTableManagementPostgres implements StorageTableManagementPort {
  constructor(private readonly executor: PgExecutor) {}

  async createStorageTable(storageTable: string): Promise<void> {
    const escapedTable = this.escapeIdentifier(storageTable);
    
    // Crea la tabella di storage fisica con chiave primaria che punta a entities(id)
    const query = `
      CREATE TABLE ${escapedTable} (
        entity_id UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE
      )
    `;
    await this.executor.query(query);
  }

  async addColumn(
    storageTable: string,
    columnName: string,
    dataType: string,
    isRequired: boolean,
    isUnique: boolean,
    defaultValueText: string | null
  ): Promise<void> {
    if (['file', 'image'].includes(dataType.toLowerCase())) return;
    const escapedTable = this.escapeIdentifier(storageTable);
    const escapedColumn = this.escapeIdentifier(columnName);
    const pgType = this.mapDataTypeToPgType(dataType, columnName, storageTable);

    let sql = `ALTER TABLE ${escapedTable} ADD COLUMN ${escapedColumn} ${pgType}`;

    if (defaultValueText !== null) {
      // Nota: Per motivi di sicurezza e semplicità DDL, facciamo il cast del default value a testo quotato.
      // In PG, DEFAULT 'valore'::tipo è sicuro.
      sql += ` DEFAULT ${this.escapeLiteral(defaultValueText)}::${pgType}`;
    }

    if (isRequired) {
      sql += ' NOT NULL';
    }

    await this.executor.query(sql);

    // Se è unico, aggiunge il vincolo UNIQUE
    if (isUnique) {
      await this.createUniqueConstraint(storageTable, columnName);
    }
  }

  async updateColumnNullability(
    storageTable: string,
    columnName: string,
    isRequired: boolean
  ): Promise<void> {
    const escapedTable = this.escapeIdentifier(storageTable);
    const escapedColumn = this.escapeIdentifier(columnName);
    const action = isRequired ? 'SET NOT NULL' : 'DROP NOT NULL';

    const sql = `ALTER TABLE ${escapedTable} ALTER COLUMN ${escapedColumn} ${action}`;
    await this.executor.query(sql);
  }

  async updateColumnDefault(
    storageTable: string,
    columnName: string,
    defaultValueText: string | null
  ): Promise<void> {
    const escapedTable = this.escapeIdentifier(storageTable);
    const escapedColumn = this.escapeIdentifier(columnName);
    
    if (defaultValueText === null) {
      const sql = `ALTER TABLE ${escapedTable} ALTER COLUMN ${escapedColumn} DROP DEFAULT`;
      await this.executor.query(sql);
    } else {
      // Dobbiamo conoscere il tipo di dato corrente della colonna per fare il cast esplicito.
      // Possiamo rilevarlo dai cataloghi di sistema di PG.
      const pgType = await this.getColumnPgType(storageTable, columnName);
      const sql = `
        ALTER TABLE ${escapedTable} 
        ALTER COLUMN ${escapedColumn} SET DEFAULT ${this.escapeLiteral(defaultValueText)}::${pgType}
      `;
      await this.executor.query(sql);
    }
  }

  async dropColumn(storageTable: string, columnName: string): Promise<void> {
    const escapedTable = this.escapeIdentifier(storageTable);
    const escapedColumn = this.escapeIdentifier(columnName);

    const sql = `ALTER TABLE ${escapedTable} DROP COLUMN ${escapedColumn}`;
    await this.executor.query(sql);
  }

  async createUniqueConstraint(storageTable: string, columnName: string): Promise<void> {
    const escapedTable = this.escapeIdentifier(storageTable);
    const escapedColumn = this.escapeIdentifier(columnName);
    const constraintName = this.escapeIdentifier(`uq_${storageTable}_${columnName}`);

    const sql = `
      ALTER TABLE ${escapedTable}
      ADD CONSTRAINT ${constraintName} UNIQUE (${escapedColumn})
    `;
    await this.executor.query(sql);
  }

  async dropUniqueConstraint(storageTable: string, columnName: string): Promise<void> {
    const escapedTable = this.escapeIdentifier(storageTable);
    const constraintName = this.escapeIdentifier(`uq_${storageTable}_${columnName}`);

    const sql = `
      ALTER TABLE ${escapedTable}
      DROP CONSTRAINT ${constraintName}
    `;
    await this.executor.query(sql);
  }

  async createIndex(storageTable: string, columnName: string): Promise<void> {
    const escapedTable = this.escapeIdentifier(storageTable);
    const escapedColumn = this.escapeIdentifier(columnName);
    const indexName = this.escapeIdentifier(`idx_${storageTable}_${columnName}`);

    // In transazione non è possibile usare CREATE INDEX CONCURRENTLY, usiamo la sintassi standard.
    const sql = `
      CREATE INDEX ${indexName} ON ${escapedTable} (${escapedColumn})
    `;
    await this.executor.query(sql);
  }

  async dropIndex(storageTable: string, columnName: string): Promise<void> {
    const indexName = this.escapeIdentifier(`idx_${storageTable}_${columnName}`);
    
    // In PG, l'indice si elimina a livello globale di schema
    const sql = `DROP INDEX ${indexName}`;
    await this.executor.query(sql);
  }

  // ─── private helpers ───────────────────────────────────────────

  private escapeIdentifier(id: string): string {
    return `"${id.replace(/"/g, '""')}"`;
  }

  private escapeLiteral(val: string): string {
    return `'${val.replace(/'/g, "''")}'`;
  }

  private mapDataTypeToPgType(dataType: string, fieldKey: string, typeKey: string): string {
    const dt = dataType.toLowerCase();
    if (['string', 'text', 'varchar'].includes(dt)) {
      return 'TEXT';
    }
    if (['integer', 'int'].includes(dt)) {
      return 'INTEGER';
    }
    if (['number', 'numeric', 'decimal', 'float', 'double'].includes(dt)) {
      return 'NUMERIC';
    }
    if (dt === 'boolean') {
      return 'BOOLEAN';
    }
    if (['date', 'datetime', 'timestamp'].includes(dt)) {
      return 'TIMESTAMPTZ';
    }
    if (['uuid', 'relation'].includes(dt)) {
      return 'UUID';
    }
    if (['json', 'array', 'enum'].includes(dt)) {
      return dt === 'enum' ? 'TEXT' : 'JSONB';
    }

    throw new UnsupportedFieldDataTypeError(fieldKey, dataType, typeKey);
  }

  private async getColumnPgType(storageTable: string, columnName: string): Promise<string> {
    const query = `
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    `;
    const result = await this.executor.query<{ data_type: string }>(query, [storageTable, columnName]);
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Column '${columnName}' not found in table '${storageTable}' information schema.`);
    }
    return row.data_type.toUpperCase();
  }
}
