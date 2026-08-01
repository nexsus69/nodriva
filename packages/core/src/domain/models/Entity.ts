/**
 * Modello di Dominio Entity.
 * Rappresenta un record di dati associato a un nodo della gerarchia e tipizzato tramite un EntityType.
 */
export class Entity {
  /**
   * @param id Identificativo univoco dell'entità.
   * @param entityTypeId Identificativo del tipo entità (UUID).
   * @param parentNodeId Identificativo del nodo genitore dell'albero (UUID).
   * @param name Nome canonico dell'entità (campo relazionale top-level).
   * @param description Descrizione dell'entità (campo relazionale top-level).
   * @param rowVersion Versione corrente del record per la concurrency ottimistica.
   * @param createdAt Data di creazione.
   * @param updatedAt Data dell'ultima modifica.
   * @param deletedAt Timestamp per il soft-delete (null se attiva).
   * @param createdBy Utente creatore.
   * @param updatedBy Ultimo utente modificatore.
   * @param payload Mappa in memoria dei campi dinamici dell'entità.
   *                NOTA ARCHITETTURALE: Il payload in-memory è espresso come dizionario generico,
   *                tuttavia a livello infrastrutturale (database adapter) può essere mappato 
   *                sia su colonne fisiche di tabelle dedicate (create dinamicamente dall'admin)
   *                sia all'interno di un campo JSON/JSONB, lasciando il dominio slegato dallo storage fisico.
   */
  constructor(
    public readonly id: string,
    public readonly entityTypeId: string,
    public readonly parentNodeId: string,
    public readonly name: string,
    public readonly description: string,
    public readonly rowVersion: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
    public readonly createdBy: string | null,
    public readonly updatedBy: string | null,
    public readonly payload: Record<string, unknown>
  ) {}

  public static create(
    id: string,
    entityTypeId: string,
    parentNodeId: string,
    name: string,
    description: string,
    createdBy: string,
    payload: Record<string, unknown>
  ): Entity {
    const now = new Date();
    return new Entity(
      id,
      entityTypeId,
      parentNodeId,
      name,
      description,
      1,
      now,
      now,
      null,
      createdBy,
      createdBy,
      payload
    );
  }

  public update(
    name: string,
    description: string,
    payload: Record<string, unknown>,
    updatedBy: string
  ): Entity {
    return new Entity(
      this.id,
      this.entityTypeId,
      this.parentNodeId,
      name,
      description,
      this.rowVersion + 1,
      this.createdAt,
      new Date(),
      this.deletedAt,
      this.createdBy,
      updatedBy,
      payload
    );
  }
}
