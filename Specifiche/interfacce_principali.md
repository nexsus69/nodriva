Service layer

Il service layer dovrebbe essere organizzato per use case applicativi e non per semplici CRUD generici. Il backend ricostruisce a runtime gli schemi dinamici dal database, li mette in un registry/cache e li usa per validare i payload prima di policy e persistenza; quindi il service layer è l’orchestratore tra schema registry, authorization, persistence abstraction, lock manager, event bus e audit trail.

Una struttura sensata è questa:

    NodeApplicationService

    EntityApplicationService

    TypeDefinitionService

    AccessControlService

    RuntimeConfigurationService

    UiConfigurationService

    LockService

    RevisionService

    AuditService

Ogni comando critico dovrebbe seguire sempre la stessa pipeline:

    autenticazione e contesto utente;

    risoluzione scope/permessi;

    validazione input strutturale;

    compilazione o recupero schema runtime;

    validazione dominio e placement policy;

    controllo row_version e lock, se richiesto;

    persistenza atomica;

    scrittura revisione e audit;

    emissione evento applicativo opzionale.

Contratti applicativi

Per evitare accoppiamento eccessivo, i servizi applicativi dovrebbero parlare tramite DTO/command/query espliciti, non tramite record DB grezzi. Questo è coerente con l’architettura layered che avevi consolidato e con la scelta di non dipendere da Prisma quando lo schema è dinamico e mutabile a runtime.

Un set minimo di command/query contracts potrebbe essere:

    CreateNodeCommand

    MoveNodeCommand

    UpdateNodeCommand

    CreateEntityCommand

    UpdateEntityCommand

    DeleteEntityCommand

    AcquireLockCommand

    ReleaseLockCommand

    UpdateSystemSettingCommand

    ResolveUiProfileQuery

    GetNodeSubtreeQuery

    GetEntityDetailQuery

    GetPagedListQuery

Esempio concettuale:

ts
type CreateEntityCommand = {
  actorUserId: string
  parentNodeId: string
  entityTypeKey: string
  payload: Record<string, unknown>
  expectedParentRowVersion?: number
  lockToken?: string | null
}

ts
type CreateEntityResult = {
  entityId: string
  rowVersion: number
  createdAt: string
}

Qui il punto importante è che payload entra grezzo, ma viene validato contro lo schema compilato dinamicamente dal registry prima della scrittura.
Contratti API

A livello API, io manterrei endpoint/procedure stabili e abbastanza semantici, lasciando al service layer il grosso della logica. Dato il tuo stack, la soluzione più coerente resta esporre questi contratti via tRPC o comunque API typed-first, ma con use case interni indipendenti dal trasporto, così HTTP/tRPC/WebSocket restano solo adapter esterni.

Una mappa iniziale può essere questa:
Area	Procedure/API
Auth	auth.login, auth.logout, auth.me, auth.refreshSession
Nodes	nodes.create, nodes.update, nodes.move, nodes.getById, nodes.getSubtree, nodes.listChildren
Entities	entities.create, entities.update, entities.delete, entities.getById, entities.listByNode
Types	entityTypes.list, entityTypes.getDefinition, entityTypes.create, entityTypes.updateSchema
Access	access.getMyScopes, access.assignNodeScope, access.removeNodeScope
UI config	ui.getProfile, ui.getViewConfig, ui.updateComponentBindings
Runtime	runtime.getCapabilities, runtime.setCapabilityOverride, runtime.getSettings
Locking	locks.acquire, locks.touch, locks.release

Per gli update critici, ogni contratto API dovrebbe portare con sé almeno uno tra expectedRowVersion e lockToken, a seconda del tipo di risorsa e della capability attiva nel runtime. Questo è in linea con il fatto che single-user e multi-user siano la stessa app con capability/configurazioni diverse.
Error model

Conviene definire anche un error model stabile, altrimenti il frontend diventa fragile. Gli errori applicativi dovrebbero essere codificati in modo prevedibile, per esempio:

    AUTH_UNAUTHORIZED

    ACCESS_FORBIDDEN

    SCOPE_FORBIDDEN

    TYPE_NOT_FOUND

    SCHEMA_VALIDATION_FAILED

    PLACEMENT_POLICY_DENIED

    ROW_VERSION_MISMATCH

    LOCK_REQUIRED

    LOCK_NOT_OWNED

    RESOURCE_NOT_FOUND

    RESOURCE_SOFT_DELETED

    CAPABILITY_DISABLED

Questo aiuta molto il frontend configurabile, perché i componenti possono reagire in modo consistente senza conoscere dettagli interni di persistenza o di dominio.

Service layer: panoramico

Organizziamo il service layer per bounded context e use case, non per CRUD generici. Ogni servizio applicativo riceve porta/adapter per:

    schemaRegistry (schemi entity/node type compilati);

    typeDefinitionRepository ( EntityType, NodeType, campi, constraint, reference);

    nodeRepository / entityRepository;

    accessControlService (scope, permessi, ruoli);

    lockService (lock espliciti);

    revisionService / auditService;

    runtimeConfigurationService (capability, settings);

    uiConfigurationService (profili, viste, componenti).

Interfacce principali

ts
// src/application/services/NodeApplicationService.ts

export type CreateNodeCommand = {
  actorUserId: string
  parentNodeId: string | null
  nodeTypeKey: string
  name: string
  description?: string
  expectedParentRowVersion?: number
  lockToken?: string | null
}

export type MoveNodeCommand = {
  actorUserId: string
  nodeId: string
  newParentNodeId: string | null
  expectedNodeRowVersion?: number
  lockToken?: string | null
}

export type UpdateNodeCommand = {
  actorUserId: string
  nodeId: string
  name?: string
  description?: string
  expectedRowVersion?: number
  lockToken?: string | null
}

export type NodeResult = {
  nodeId: string
  rowVersion: number
  createdAt: string
  updatedAt: string
}

export interface NodeApplicationService {
  createNode(cmd: CreateNodeCommand): Promise<NodeResult>
  updateNode(cmd: UpdateNodeCommand): Promise<NodeResult>
  moveNode(cmd: MoveNodeCommand): Promise<NodeResult>
  getNodeById(nodeId: string): Promise<NodeDetailDto>
  getNodeSubtree(rootNodeId: string, limit?: number): Promise<NodeSubtreeDto>
  listChildren(parentNodeId: string, cursor?: string, pageSize?: number): Promise<NodeListPageDto>
}

ts
// src/application/services/EntityApplicationService.ts

export type CreateEntityCommand = {
  actorUserId: string
  parentNodeId: string
  entityTypeKey: string
  payload: Record<string, unknown>
  expectedParentRowVersion?: number
  lockToken?: string | null
}

export type UpdateEntityCommand = {
  actorUserId: string
  entityId: string
  payloadDelta: Record<string, unknown>
  expectedRowVersion?: number
  lockToken?: string | null
}

export type EntityResult = {
  entityId: string
  rowVersion: number
  createdAt: string
  updatedAt: string
}

export interface EntityApplicationService {
  createEntity(cmd: CreateEntityCommand): Promise<EntityResult>
  updateEntity(cmd: UpdateEntityCommand): Promise<EntityResult>
  deleteEntity(entityId: string, actorUserId: string, lockToken?: string | null): Promise<void>
  getEntityById(entityId: string): Promise<EntityDetailDto>
  listEntitiesByNode(parentNodeId: string, entityTypeKey?: string, cursor?: string, pageSize?: number): Promise<EntityListPageDto>
}

ts
// src/application/services/LockService.ts

export type AcquireLockCommand = {
  actorUserId: string
  resourceKind: 'node' | 'entity' | 'node_type' | 'entity_type' | 'system_setting'
  resourceId: string
  expiresInSeconds: number
}

export type LockResult = {
  lockId: string
  lockToken: string
  expiresAt: string
}

export interface LockService {
  acquireLock(cmd: AcquireLockCommand): Promise<LockResult>
  touchLock(resourceKind: string, resourceId: string, lockToken: string, extendSeconds: number): Promise<boolean>
  releaseLock(resourceKind: string, resourceId: string, lockToken: string): Promise<void>
}

ts
// src/application/services/AccessControlService.ts

export type ScopeAssignment = {
  userId: string
  nodeId: string
  roleId: string | null
  effect: 'allow' | 'deny'
  propagation: 'self' | 'subtree'
}

export interface AccessControlService {
  getEffectivePermissions(userId: string, nodeId: string): Promise<PermissionSetDto>
  listUserScopes(userId: string): Promise<ScopeAssignment[]>
  assignNodeScope(cmd: ScopeAssignment, actorUserId: string): Promise<void>
  removeNodeScope(userId: string, nodeId: string, roleId: string | null, actorUserId: string): Promise<void>
}

ts
// src/application/services/RuntimeConfigurationService.ts

export type CapabilityOverride = {
  capabilityKey: string
  scopeKey: string
  status: 'enabled' | 'disabled' | 'optional'
}

export interface RuntimeConfigurationService {
  getCapabilities(): Promise<CapabilityDto[]>
  getCapabilityOverride(capabilityKey: string, scopeKey: string): Promise<CapabilityOverride | null>
  setCapabilityOverride(override: CapabilityOverride, actorUserId: string): Promise<void>
  getSetting(settingKey: string): Promise<SettingDto>
  updateSetting(settingKey: string, value: unknown, actorUserId: string): Promise<void>
}

ts
// src/application/services/UiConfigurationService.ts

export type UiProfileDto = {
  profileKey: string
  name: string
  isDefault: boolean
  views: UiViewDto[]
}

export type UiViewDto = {
  viewKey: string
  name: string
  routePattern?: string
  entityTypeKey?: string
  nodeTypeKey?: string
  regions: UiViewRegionDto[]
}

export type UiViewRegionDto = {
  regionKey: string
  name: string
  components: UiComponentDto[]
}

export type UiComponentDto = {
  componentKey: string
  componentKind: string
  title: string
  isEnabled: boolean
  bindings: Record<string, string>
}

export interface UiConfigurationService {
  resolveUiProfile(profileKey?: string | null): Promise<UiProfileDto>
  getViewConfig(profileKey: string, viewKey: string): Promise<UiViewDto>
  updateComponentBindings(profileKey: string, viewKey: string, regionKey: string, componentKey: string, bindings: Record<string, string>, actorUserId: string): Promise<void>
}

I dettagli di validazione dinamica, policy e revisioni restano dentro l’implementazione: i contratti qui sopra sono già abbastanza stabili da essere usati come base per tRPC e per il frontend.
Contratti API / tRPC

Organizziamo i router tRPC per area funzionale, mappando 1:1 sui use case applicativi. Questo mantiene il trasporto snello e lascia al service layer la logica.

ts
// src/api/routers/nodes.ts

const nodeRouter = router({
  create: protectedProcedure
    .input(z.object({
      parentNodeId: z.string().uuid().nullable(),
      nodeTypeKey: z.string(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      expectedParentRowVersion: z.number().int().positive().optional(),
      lockToken: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cmd: CreateNodeCommand = {
        actorUserId: ctx.user.id,
        parentNodeId: input.parentNodeId,
        nodeTypeKey: input.nodeTypeKey,
        name: input.name,
        description: input.description,
        expectedParentRowVersion: input.expectedParentRowVersion,
        lockToken: input.lockToken ?? null,
      }
      return ctx.nodeApplicationService.createNode(cmd)
    }),

  update: protectedProcedure
    .input(z.object({
      nodeId: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      expectedRowVersion: z.number().int().positive().optional(),
      lockToken: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cmd: UpdateNodeCommand = {
        actorUserId: ctx.user.id,
        nodeId: input.nodeId,
        name: input.name,
        description: input.description,
        expectedRowVersion: input.expectedRowVersion,
        lockToken: input.lockToken ?? null,
      }
      return ctx.nodeApplicationService.updateNode(cmd)
    }),

  move: protectedProcedure
    .input(z.object({
      nodeId: z.string().uuid(),
      newParentNodeId: z.string().uuid().nullable(),
      expectedNodeRowVersion: z.number().int().positive().optional(),
      lockToken: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cmd: MoveNodeCommand = {
        actorUserId: ctx.user.id,
        nodeId: input.nodeId,
        newParentNodeId: input.newParentNodeId,
        expectedNodeRowVersion: input.expectedNodeRowVersion,
        lockToken: input.lockToken ?? null,
      }
      return ctx.nodeApplicationService.moveNode(cmd)
    }),

  getById: protectedProcedure
    .input(z.object({ nodeId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.nodeApplicationService.getNodeById(input.nodeId)
    }),

  getSubtree: protectedProcedure
    .input(z.object({
      rootNodeId: z.string().uuid(),
      limit: z.number().int().positive().optional().default(200),
    }))
    .query(async ({ input, ctx }) => {
      return ctx.nodeApplicationService.getNodeSubtree(input.rootNodeId, input.limit)
    }),

  listChildren: protectedProcedure
    .input(z.object({
      parentNodeId: z.string().uuid(),
      cursor: z.string().optional(),
      pageSize: z.number().int().positive().min(1).max(100).optional().default(50),
    }))
    .query(async ({ input, ctx }) => {
      return ctx.nodeApplicationService.listChildren(input.parentNodeId, input.cursor, input.pageSize)
    }),
})

ts
// src/api/routers/entities.ts

const entityRouter = router({
  create: protectedProcedure
    .input(z.object({
      parentNodeId: z.string().uuid(),
      entityTypeKey: z.string(),
      payload: z.record(z.unknown()),
      expectedParentRowVersion: z.number().int().positive().optional(),
      lockToken: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cmd: CreateEntityCommand = {
        actorUserId: ctx.user.id,
        parentNodeId: input.parentNodeId,
        entityTypeKey: input.entityTypeKey,
        payload: input.payload,
        expectedParentRowVersion: input.expectedParentRowVersion,
        lockToken: input.lockToken ?? null,
      }
      return ctx.entityApplicationService.createEntity(cmd)
    }),

  update: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      payloadDelta: z.record(z.unknown()),
      expectedRowVersion: z.number().int().positive().optional(),
      lockToken: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cmd: UpdateEntityCommand = {
        actorUserId: ctx.user.id,
        entityId: input.entityId,
        payloadDelta: input.payloadDelta,
        expectedRowVersion: input.expectedRowVersion,
        lockToken: input.lockToken ?? null,
      }
      return ctx.entityApplicationService.updateEntity(cmd)
    }),

  delete: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      lockToken: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.entityApplicationService.deleteEntity(
        input.entityId,
        ctx.user.id,
        input.lockToken ?? null
      )
    }),

  getById: protectedProcedure
    .input(z.object({ entityId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.entityApplicationService.getEntityById(input.entityId)
    }),

  listByNode: protectedProcedure
    .input(z.object({
      parentNodeId: z.string().uuid(),
      entityTypeKey: z.string().optional(),
      cursor: z.string().optional(),
      pageSize: z.number().int().positive().min(1).max(100).optional().default(50),
    }))
    .query(async ({ input, ctx }) => {
      return ctx.entityApplicationService.listEntitiesByNode(
        input.parentNodeId,
        input.entityTypeKey,
        input.cursor,
        input.pageSize
      )
    }),
})

ts
// src/api/routers/locks.ts

const lockRouter = router({
  acquire: protectedProcedure
    .input(z.object({
      resourceKind: z.enum(['node', 'entity', 'node_type', 'entity_type', 'system_setting']),
      resourceId: z.string().uuid(),
      expiresInSeconds: z.number().int().positive().min(10).max(3600).default(300),
    }))
    .mutation(async ({ input, ctx }) => {
      const cmd: AcquireLockCommand = {
        actorUserId: ctx.user.id,
        resourceKind: input.resourceKind,
        resourceId: input.resourceId,
        expiresInSeconds: input.expiresInSeconds,
      }
      return ctx.lockService.acquireLock(cmd)
    }),

  touch: protectedProcedure
    .input(z.object({
      resourceKind: z.enum(['node', 'entity', 'node_type', 'entity_type', 'system_setting']),
      resourceId: z.string().uuid(),
      lockToken: z.string(),
      extendSeconds: z.number().int().positive().min(10).max(3600).default(300),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.lockService.touchLock(
        input.resourceKind,
        input.resourceId,
        input.lockToken,
        input.extendSeconds
      )
    }),

  release: protectedProcedure
    .input(z.object({
      resourceKind: z.enum(['node', 'entity', 'node_type', 'entity_type', 'system_setting']),
      resourceId: z.string().uuid(),
      lockToken: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.lockService.releaseLock(
        input.resourceKind,
        input.resourceId,
        input.lockToken
      )
    }),
})

ts
// src/api/routers/ui.ts

const uiRouter = router({
  resolveProfile: publicProcedure
    .input(z.object({
      profileKey: z.string().optional().nullable(),
    }))
    .query(async ({ input, ctx }) => {
      return ctx.uiConfigurationService.resolveUiProfile(input.profileKey)
    }),

  getViewConfig: publicProcedure
    .input(z.object({
      profileKey: z.string(),
      viewKey: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      return ctx.uiConfigurationService.getViewConfig(input.profileKey, input.viewKey)
    }),

  updateComponentBindings: protectedProcedure
    .input(z.object({
      profileKey: z.string(),
      viewKey: z.string(),
      regionKey: z.string(),
      componentKey: z.string(),
      bindings: z.record(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.uiConfigurationService.updateComponentBindings(
        input.profileKey,
        input.viewKey,
        input.regionKey,
        input.componentKey,
        input.bindings,
        ctx.user.id
      )
    }),
})

ts
// src/api/routers/runtime.ts

const runtimeRouter = router({
  getCapabilities: publicProcedure
    .query(async ({ ctx }) => {
      return ctx.runtimeConfigurationService.getCapabilities()
    }),

  setCapabilityOverride: protectedProcedure
    .input(z.object({
      capabilityKey: z.string(),
      scopeKey: z.string(),
      status: z.enum(['enabled', 'disabled', 'optional']),
    }))
    .mutation(async ({ input, ctx }) => {
      const override: CapabilityOverride = {
        capabilityKey: input.capabilityKey,
        scopeKey: input.scopeKey,
        status: input.status,
      }
      return ctx.runtimeConfigurationService.setCapabilityOverride(override, ctx.user.id)
    }),

  getSetting: publicProcedure
    .input(z.object({ settingKey: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.runtimeConfigurationService.getSetting(input.settingKey)
    }),

  updateSetting: protectedProcedure
    .input(z.object({
      settingKey: z.string(),
      value: z.unknown(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.runtimeConfigurationService.updateSetting(
        input.settingKey,
        input.value,
        ctx.user.id
      )
    }),
})

ts
// src/api/routers/_app.ts

export const appRouter = router({
  nodes: nodeRouter,
  entities: entityRouter,
  locks: lockRouter,
  ui: uiRouter,
  runtime: runtimeRouter,
  // auth, types, ecc. separati
})

export type AppRouter = typeof appRouter

Error model

Definiamo un error model stabile, così il frontend può reagire in modo coerente.

ts
// src/application/errors.ts

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const Errors = {
  AUTH_UNAUTHORIZED: (msg = 'Unauthorized') => new AppError('AUTH_UNAUTHORIZED', msg),
  ACCESS_FORBIDDEN: (msg = 'Access forbidden') => new AppError('ACCESS_FORBIDDEN', msg),
  SCOPE_FORBIDDEN: (nodeId?: string) => new AppError('SCOPE_FORBIDDEN', `No access to scope`, nodeId ? { nodeId } : undefined),
  TYPE_NOT_FOUND: (typeKey: string) => new AppError('TYPE_NOT_FOUND', `Type not found: ${typeKey}`, { typeKey }),
  SCHEMA_VALIDATION_FAILED: (issues: unknown[]) => new AppError('SCHEMA_VALIDATION_FAILED', 'Schema validation failed', { issues }),
  PLACEMENT_POLICY_DENIED: (reason?: string) => new AppError('PLACEMENT_POLICY_DENIED', reason ?? 'Placement policy denied'),
  ROW_VERSION_MISMATCH: (expected?: number, actual?: number) =>
    new AppError('ROW_VERSION_MISMATCH', 'Row version mismatch', { expected, actual }),
  LOCK_REQUIRED: (resourceKind: string, resourceId: string) =>
    new AppError('LOCK_REQUIRED', 'Lock required', { resourceKind, resourceId }),
  LOCK_NOT_OWNED: (resourceKind: string, resourceId: string) =>
    new AppError('LOCK_NOT_OWNED', 'Lock not owned', { resourceKind, resourceId }),
  RESOURCE_NOT_FOUND: (kind: string, id: string) =>
    new AppError('RESOURCE_NOT_FOUND', `${kind} not found`, { kind, id }),
  RESOURCE_SOFT_DELETED: (kind: string, id: string) =>
    new AppError('RESOURCE_SOFT_DELETED', `${kind} is deleted`, { kind, id }),
  CAPABILITY_DISABLED: (capabilityKey: string) =>
    new AppError('CAPABILITY_DISABLED', `Capability disabled: ${capabilityKey}`, { capabilityKey }),
}
