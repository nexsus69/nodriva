export interface AccessControlPort {
  assertCanCreateNode(actorUserId: string, parentNodeId: string | null, nodeTypeKey: string): Promise<void>;
  assertCanMoveNode(actorUserId: string, nodeId: string, newParentId: string | null): Promise<void>;
  assertCanReadNode(actorUserId: string, nodeId: string | null): Promise<void>;
  assertCanCreateEntity(actorUserId: string, parentNodeId: string, entityTypeKey: string): Promise<void>;
  assertCanEditEntity(actorUserId: string, entityId: string): Promise<void>;
  assertCanMoveEntity(actorUserId: string, entityId: string, newParentNodeId: string): Promise<void>;

  /**
   * Verifica se l'utente possiede un determinato permesso.
   * Se nodeId è null, si intende un'operazione su Scope Globale (Root).
   * Lancia ForbiddenError se il permesso non è posseduto.
   */
  assertHasPermission(actorUserId: string, permissionKey: string, nodeId: string | null): Promise<void>;
}
