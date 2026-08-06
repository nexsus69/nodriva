export interface AccessControlPort {
  assertCanCreateNode(actorUserId: string, parentNodeId: string | null, nodeTypeKey: string): Promise<void>;
  assertCanMoveNode(actorUserId: string, nodeId: string, newParentId: string | null): Promise<void>;
  assertCanReadNode(actorUserId: string, nodeId: string | null): Promise<void>;
  assertCanCreateEntity(actorUserId: string, parentNodeId: string, entityTypeKey: string): Promise<void>;
  assertCanEditEntity(actorUserId: string, entityId: string): Promise<void>;
  assertCanDeleteEntity(actorUserId: string, entityId: string): Promise<void>;
  assertCanMoveEntity(actorUserId: string, entityId: string, newParentNodeId: string): Promise<void>;

  /**
   * Verifica se l'utente possiede un determinato permesso.
   * Se nodeId è null, si intende un'operazione su Scope Globale (Root).
   * Lancia ForbiddenError se il permesso non è posseduto.
   */
  assertHasPermission(actorUserId: string, permissionKey: string, nodeId: string | null): Promise<void>;

  /**
   * Verifica che l'attore possa esercitare e delegare un permesso sull'intera
   * copertura richiesta. `subtree` richiede un allow subtree che copra il nodo
   * e nessun deny che intersechi l'area; non basta un permesso `self` sul nodo.
   */
  assertHasPermissionCoverage(
    actorUserId: string,
    permissionKey: string,
    nodeId: string,
    propagation: 'self' | 'subtree'
  ): Promise<void>;

  /** Set-based equivalent used when delegating a role permission bundle. */
  assertHasPermissionCoverageBatch(
    actorUserId: string,
    permissionKeys: readonly string[],
    nodeId: string,
    propagation: 'self' | 'subtree'
  ): Promise<void>;

  /** Global trust-boundary check for operations that alter permission models. */
  assertIsSuperAdmin(actorUserId: string): Promise<void>;
}
