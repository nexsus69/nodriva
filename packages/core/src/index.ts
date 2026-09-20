/** Exposes the public Core API consumed by composition roots and external packages. */
// ─── Domain Models ───────────────────────────────────────────────────────────
export { PasswordHasher } from "./domain/policies/PasswordHasher.js";
export { WorkflowPlanner } from "./application/services/WorkflowPlanner.js";
export { WorkflowEventProcessor } from "./application/services/WorkflowEventProcessor.js";
export type { WorkflowEventProcessingResult } from "./application/services/WorkflowEventProcessor.js";
export { createUserWorkflowEvent } from "./application/services/WorkflowEventFactory.js";
export type { UserWorkflowEventInput } from "./application/services/WorkflowEventFactory.js";
export type { WorkflowEventPublisher } from "./application/ports/WorkflowEventPublisher.js";
export { WorkflowWorker } from "./application/services/WorkflowWorker.js";
export { DescriptiveAuditPort } from "./application/services/DescriptiveAuditPort.js";
export type { WorkflowWorkerRunResult } from "./application/services/WorkflowWorker.js";
export { AuditRecordWorkflowActionHandler } from "./application/services/AuditRecordWorkflowActionHandler.js";
export { WorkflowDefinitionService } from "./application/services/WorkflowDefinitionService.js";
export { WorkflowAdminApplicationService } from "./application/services/WorkflowAdminApplicationService.js";
export type { WorkflowActionHandler, WorkflowActionRegistry } from "./application/ports/WorkflowActionHandler.js";
export type { EventSubject, EventTypeDefinition, WorkflowCondition, WorkflowDefinition, WorkflowEvent, WorkflowExecutionPlan, WorkflowExecutionStep, WorkflowStepDefinition } from "./domain/events/WorkflowEvent.js";
export type { WorkflowOperationalStats, WorkflowRepository } from "./application/ports/WorkflowRepository.js";
export { Node } from "./domain/models/Node.js";
export { Entity } from "./domain/models/Entity.js";
export { Lock } from "./domain/models/Lock.js";
export { resourceReference } from "./domain/models/ResourceReference.js";
export type {
  ResourceKind,
  ResourceReference,
} from "./domain/models/ResourceReference.js";
export {
  ConfigurationRegistry,
  defaultConfigurationRegistry,
  sessionIdleTimeoutDefinition,
  attachmentAntivirusEnabledDefinition,
  attachmentEncryptionEnabledDefinition,
  fieldEncryptionEnabledDefinition,
  auditLockLifecycleDefinition,
} from "./application/config/ConfigurationRegistry.js";
export {
  PolicyAuditRecorder,
  RuntimeAuditRecordingPolicy,
  AUDIT_ACTION_POLICY_CATALOG,
  AUDIT_LOCK_LIFECYCLE_SETTING,
} from "./application/services/PolicyAuditRecorder.js";
export { RealtimeAuditCollectionInvalidator, REALTIME_CAPABILITY_KEY } from "./application/services/RealtimeAuditCollectionInvalidator.js";
export type {
  AuditActionPolicyDefinition,
  AuditEvent,
  AuditRecordingPolicy,
} from "./application/services/PolicyAuditRecorder.js";
export type {
  AuditCollectionInvalidation,
  AuditCollectionInvalidationPort,
} from "./application/ports/AuditCollectionInvalidationPort.js";
export type {
  ConfigurationDefinition,
  ConfigurationSource,
  ConfigurationValueType,
} from "./application/config/ConfigurationRegistry.js";
export {
  ServiceConfigurationRegistry,
  defaultServiceConfigurationRegistry,
} from "./application/config/ServiceConfigurationRegistry.js";
export type {
  ServiceConfigurationDefinition,
  ServiceConfigurationFieldDefinition,
  ServiceConfigurationKey,
  ServiceConfigurationSource,
  ServiceConfigurationValueType,
  ServiceProviderDefinition,
} from "./application/config/ServiceConfigurationRegistry.js";
export {
  ServiceConfigurationService,
  ServiceConfigurationValidationError,
} from "./application/services/ServiceConfigurationService.js";
export {
  EffectiveCapabilityResolver,
} from "./application/services/EffectiveCapabilityResolver.js";
export type {
  EffectiveCapability,
  EffectiveCapabilityStatus,
} from "./application/services/EffectiveCapabilityResolver.js";
export { ServiceAdministrationApplicationService } from "./application/services/ServiceAdministrationApplicationService.js";
export type {
  EffectiveServiceConfiguration,
  PublicServiceConfiguration,
} from "./application/services/ServiceConfigurationService.js";
export {
  SUPPORTED_LOCALES,
  normalizeLocale,
  negotiateLocale,
} from "./application/i18n/Locale.js";
export type {
  SupportedLocale,
  LocalizedMessage,
} from "./application/i18n/Locale.js";
export type {
  SecretReferenceResolver,
  ServiceConfigurationRepository,
  ServiceDeploymentConfigurationSource,
  ServiceRuntimeConfigurationRecord,
} from "./application/ports/ServiceConfigurationRepository.js";
export { DefaultServiceHealthCheckRegistry } from "./application/ports/ServiceHealthCheckPort.js";
export type {
  ServiceHealthCheckPort,
  ServiceHealthCheckRegistry,
  ServiceHealthCheckResult,
} from "./application/ports/ServiceHealthCheckPort.js";
export type {
  BackupStatusPort,
  BackupRecoveryStatus,
  PublicBackupStatus,
} from "./application/ports/BackupStatusPort.js";
export { ServiceHealthCheckService } from "./application/services/ServiceHealthCheckService.js";
export { ResourceRelationshipService } from "./application/services/ResourceRelationshipService.js";
export { ResourceDeletionPolicyService } from "./application/services/ResourceDeletionPolicyService.js";
export { ResourceDeleteRestrictedError } from "./domain/errors/ResourceRelationshipErrors.js";
export { ResourceRelationshipMutationService } from "./application/services/ResourceRelationshipMutationService.js";
export { RelationshipMutationImpactPolicy } from "./domain/policies/RelationshipMutationImpactPolicy.js";
export { RelationshipMutationPlanner } from "./application/services/RelationshipMutationPlanner.js";
export { RelationshipMutationCommitter } from "./application/services/RelationshipMutationCommitter.js";
export { BatchMutationConcurrencyGuard } from "./application/services/BatchMutationConcurrencyGuard.js";
export type {
  RelationshipMutationResource,
  RelationshipMutationResult,
} from "./application/services/ResourceRelationshipMutationService.js";
export type {
  RelationshipMutationImpact,
  RelationshipMutationImpactInput,
  RelationshipMutationImpactKind,
  RelationshipMutationOperation,
} from "./domain/policies/RelationshipMutationImpactPolicy.js";
export type {
  RelationshipMutationFieldPlan,
  RelationshipMutationPlan,
  RelationshipMutationPlanItem,
} from "./application/dto/RelationshipMutationPlan.js";
export type {
  IncomingResourceRelationshipDefinition,
  ResourceRelationshipDefinitionReader,
} from "./application/ports/ResourceRelationshipDefinitionReader.js";
export { ServiceConfigurationRepositoryPostgres } from "./infrastructure/postgres/ServiceConfigurationRepositoryPostgres.js";
export { ServiceConfigurationRepositorySqlite } from "./infrastructure/sqlite/ServiceConfigurationRepositorySqlite.js";
export { AuditQueryPortSqlite } from "./infrastructure/sqlite/AuditQueryPortSqlite.js";
export { SecurityRepositorySqlite } from "./infrastructure/sqlite/SecurityRepositorySqlite.js";
export { SystemConfigRepositorySqlite } from "./infrastructure/sqlite/SystemConfigRepositorySqlite.js";
export { TypeDefinitionAdminRepositorySqlite } from "./infrastructure/sqlite/TypeDefinitionAdminRepositorySqlite.js";
export { ResourceRelationshipRepositorySqlite } from "./infrastructure/sqlite/ResourceRelationshipRepositorySqlite.js";
export { ResourceRelationshipDefinitionReaderSqlite } from "./infrastructure/sqlite/ResourceRelationshipDefinitionReaderSqlite.js";
export { EntitySubtreeQueryPortSqlite } from "./infrastructure/sqlite/EntitySubtreeQueryPortSqlite.js";
export { AdminContentCatalogQueryPortSqlite } from "./infrastructure/sqlite/AdminContentCatalogQueryPortSqlite.js";
export { RealtimeScopeResolverSqlite } from "./infrastructure/sqlite/RealtimeScopeResolverSqlite.js";
export { FieldEncryptionServiceSqlite } from "./infrastructure/sqlite/FieldEncryptionServiceSqlite.js";
export { SystemSeedSqlite } from "./infrastructure/sqlite/SystemSeedSqlite.js";
export type {
  ConfigurationRecord,
  ConfigurationRepository,
} from "./application/ports/ConfigurationRepository.js";
export { ConfigService } from "./application/services/ConfigService.js";
export type { SessionTimingPolicy } from "./application/services/ConfigService.js";
export type { SessionTimingPolicyPort } from "./application/ports/SessionTimingPolicyPort.js";
export { ConfigurationRepositoryPostgres } from "./infrastructure/postgres/ConfigurationRepositoryPostgres.js";
export { FieldEncryptionService } from "./infrastructure/postgres/FieldEncryptionService.js";
export { ResourceRelationshipRepositoryPostgres } from "./infrastructure/postgres/ResourceRelationshipRepositoryPostgres.js";
export { ResourceRelationshipDefinitionReaderPostgres } from "./infrastructure/postgres/ResourceRelationshipDefinitionReaderPostgres.js";
export { EncryptionKeyring } from "./infrastructure/crypto/EncryptionKeyring.js";
export { NodeType } from "./domain/models/NodeType.js";
export { EntityType } from "./domain/models/EntityType.js";
export { ManagedTypeDefinition } from "./domain/models/ManagedTypeDefinition.js";
export { ManagedTypeField } from "./domain/models/ManagedTypeField.js";
export { ManagedTypeFieldConstraint } from "./domain/models/ManagedTypeFieldConstraint.js";
export { resourceTypeReference } from "./application/dto/ResourceSchema.js";
export type {
  ResourceTypeReference,
  ResourceFieldDefinition,
} from "./application/dto/ResourceSchema.js";
export {
  resourceRelationDefinition,
  resourceContainmentRule,
} from "./application/dto/ResourceRelations.js";
export type {
  ResourceRelationDefinition,
  ResourceRelationKind,
  ResourceRelationCardinality,
  ResourceContainmentRule,
} from "./application/dto/ResourceRelations.js";
export {
  resourceViewDefinition,
  resourceActionDefinition,
} from "./application/dto/ResourceViews.js";
export type {
  ResourceViewColumn,
  ResourceViewColumnKind,
  ResourceFilterDefinition,
  ResourceFilterKind,
  ResourceViewDefinition,
  ResourceActionDefinition,
} from "./application/dto/ResourceViews.js";
export { validateAttachmentSelection } from "./application/dto/ResourceAttachment.js";
export {
  defaultAttachmentSecurityPolicy,
  detectAttachmentType,
} from "./application/dto/AttachmentSecurityPolicy.js";
export type { AttachmentSecurityPolicy } from "./application/dto/AttachmentSecurityPolicy.js";
export type {
  ResourceAttachmentKind,
  ResourceAttachmentReference,
  ResourceAttachmentConstraints,
  ResourceAttachmentSelection,
} from "./application/dto/ResourceAttachment.js";
export type {
  AttachmentStoragePort,
  StoredAttachment,
} from "./application/ports/AttachmentStoragePort.js";
export type {
  AttachmentCleanupPort,
  PendingAttachmentCleanup,
} from "./application/ports/AttachmentCleanupPort.js";
export type {
  AttachmentScannerPort,
  AttachmentScanResult,
} from "./application/ports/AttachmentScannerPort.js";
export type {
  ResourceSecurityPolicyResolver,
  ResourceSecurityPolicy,
  SecuredResourceType,
} from "./application/ports/ResourceSecurityPolicyResolver.js";

// ─── Domain & Application Errors ─────────────────────────────────────────────
export { AppError } from "./domain/errors/AppError.js";
export {
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  CapabilityDisabledError,
  LockConflictError,
  LockNotFoundError,
  LockExpiredError,
  LockForbiddenError,
} from "./domain/errors/ApplicationErrors.js";
export {
  NodeNotFoundError,
  NodeTypeNotFoundError as NodeDomainTypeNotFoundError,
  NodePathCollisionError,
  RowVersionMismatchError,
  NodeCyclicMoveError,
} from "./domain/errors/DomainErrors.js";
export {
  EntityNotFoundError,
  EntityTypeNotFoundError,
  EntitySchemaValidationError,
  EntityCommandValidationError,
} from "./domain/errors/EntityErrors.js";
export {
  UnsupportedFieldDataTypeError,
  SchemaCompilationError,
} from "./domain/errors/SchemaErrors.js";
export {
  TypeAdminValidationError,
  TypeDefinitionNotFoundError,
  TypeFieldNotFoundError,
  TypeFieldConstraintNotFoundError,
  TypeKeyAlreadyExistsError,
  TypeFieldKeyAlreadyExistsError,
  TypeFieldColumnNameAlreadyExistsError,
  SystemTypeModificationError,
  SystemFieldModificationError,
  TypeHasInstancesError,
  TypeFieldHasValuesError,
} from "./domain/errors/TypeAdminErrors.js";
export { ManagedEnumOption } from "./domain/models/ManagedEnumOption.js";

// ─── Application DTOs & Commands ──────────────────────────────────────────────
export {
  TypeDomain,
  ConstraintType,
  TypeFieldConstraint,
  TypeFieldDefinition,
  TypeDefinition,
} from "./application/dto/TypeFieldDefinition.js";
export {
  MutateResourceRelationshipCommandSchema,
} from "./application/commands/ResourceRelationshipCommands.js";
export type {
  MutateResourceRelationshipCommand,
} from "./application/commands/ResourceRelationshipCommands.js";
export type {
  RealtimeOutboxPort,
  RealtimeOutboxOperationalStats,
} from "./application/ports/RealtimeOutboxPort.js";
export { RealtimeOutboxPostgres } from "./infrastructure/postgres/RealtimeOutboxPostgres.js";
export {
  TypeKind,
  FieldDataType,
  FieldConstraintDto,
  EnumOptionDto,
  EnumMode,
  FieldDto,
  FieldEncryptionMode,
  TypeListItemDto,
  TypeDetailDto,
  CreateTypeCommand as CreateTypeAdminCommand,
  CreateTypeCommandSchema as CreateTypeAdminCommandSchema,
  CreateTypeUiCommand,
  UpdateTypeCommand as UpdateTypeAdminCommand,
  UpdateTypeCommandSchema as UpdateTypeAdminCommandSchema,
  UpdateTypeUiCommand,
  DisableTypeCommand as DisableTypeAdminCommand,
  DisableTypeCommandSchema as DisableTypeAdminCommandSchema,
  DisableTypeUiCommand,
  CreateFieldCommand as CreateFieldAdminCommand,
  CreateFieldCommandSchema as CreateFieldAdminCommandSchema,
  CreateFieldUiCommand,
  UpdateFieldCommand as UpdateFieldAdminCommand,
  UpdateFieldCommandSchema as UpdateFieldAdminCommandSchema,
  UpdateFieldUiCommand,
  DeleteFieldCommand as DeleteFieldAdminCommand,
  DeleteFieldCommandSchema as DeleteFieldAdminCommandSchema,
  DeleteFieldUiCommand,
  ReorderFieldsCommand,
  ReorderFieldsCommandSchema,
  ReorderFieldsUiCommand,
  ApiErrorDetail,
  ApiErrorResponse,
  TypeSchemaImpactDto,
  TypeSchemaRollbackPlanDto,
} from "./application/dto/AdminContractDtos.js";
export {
  CreateNodeCommand,
  CreateNodeCommandSchema,
  UpdateNodeCommand,
  UpdateNodeCommandSchema,
  MoveNodeCommand,
  MoveNodeCommandSchema,
  DeleteNodeCommand,
  DeleteNodeCommandSchema,
  RestoreNodeCommand,
  RestoreNodeCommandSchema,
} from "./application/commands/NodeCommands.js";
export {
  CreateEntityCommand,
  CreateEntityCommandSchema,
  UpdateEntityCommand,
  UpdateEntityCommandSchema,
  DeleteEntityCommand,
  DeleteEntityCommandSchema,
} from "./application/commands/EntityCommands.js";
export {
  CreateTypeCommand,
  CreateTypeCommandSchema,
  UpdateTypeCommand,
  UpdateTypeCommandSchema,
  DisableTypeCommand,
  EnableTypeCommandSchema,
  EnableTypeCommand,
  DisableTypeCommandSchema,
  AddFieldCommand,
  AddFieldCommandSchema,
  UpdateFieldCommand,
  UpdateFieldCommandSchema,
  RemoveFieldCommand,
  RemoveFieldCommandSchema,
  AddConstraintCommand,
  AddConstraintCommandSchema,
  UpdateConstraintCommand,
  UpdateConstraintCommandSchema,
  RemoveConstraintCommand,
  RemoveConstraintCommandSchema,
} from "./application/commands/TypeAdminCommands.js";

// ─── Application Ports ────────────────────────────────────────────────────────
export { AccessControlPort } from "./application/ports/AccessControlPort.js";
export { AuditPort } from "./application/ports/AuditPort.js";
export { LoginRateLimitPort } from "./application/ports/LoginRateLimitPort.js";
export { AccountActionTokenPort } from "./application/ports/AccountActionTokenPort.js";
export type { AccountActionPurpose } from "./application/ports/AccountActionTokenPort.js";
export { AccountActionDeliveryPort } from "./application/ports/AccountActionDeliveryPort.js";
export type { AccountActionDeliveryOutboxPort, PendingAccountActionDelivery } from "./application/ports/AccountActionDeliveryOutboxPort.js";
export type { AccountActionTokenCipherPort } from "./application/ports/AccountActionTokenCipherPort.js";
export { MfaTotpPort } from "./application/ports/MfaTotpPort.js";
export type { MfaTotpRecord } from "./application/ports/MfaTotpPort.js";
export { EntityRepository } from "./application/ports/EntityRepository.js";
export { EntityTypeRepository } from "./application/ports/EntityTypeRepository.js";
export { NodeRepository } from "./application/ports/NodeRepository.js";
export { NodeTypeRepository } from "./application/ports/NodeTypeRepository.js";
export { RevisionPort } from "./application/ports/RevisionPort.js";
export { RuntimeConfigurationPort } from "./application/ports/RuntimeConfigurationPort.js";
export { TransactionPort } from "./application/ports/TransactionPort.js";
export { LockRepository } from "./application/ports/LockRepository.js";
export { LockEventBus } from "./application/ports/LockEventBus.js";
export {
  RealtimeEventBus,
  RealtimeDataChangedEvent,
  RealtimeResourceType,
  RealtimeChangeType,
  RealtimeChannelStreamPosition,
} from "./application/ports/RealtimeEventBus.js";
export { SessionRepositoryPort } from "./application/ports/SessionRepositoryPort.js";
export { RealtimeScopeResolver } from "./application/ports/RealtimeScopeResolver.js";
export { IdGeneratorPort } from "./application/ports/IdGeneratorPort.js";
export { SchemaRegistry } from "./application/ports/SchemaRegistry.js";
export { TypeDefinitionReader } from "./application/ports/TypeDefinitionReader.js";
export { TypeDefinitionAdminRepository } from "./application/ports/TypeDefinitionAdminRepository.js";
export type { TypeListPage, TypeListPageParams } from "./application/ports/TypeDefinitionAdminRepository.js";
export { StorageTableManagementPort } from "./application/ports/StorageTableManagementPort.js";
export type {
  ResourceRelationshipRepository,
  ResourceRelationshipEdge,
  ReplaceResourceRelationshipValues,
} from "./application/ports/ResourceRelationshipRepository.js";
export { SchemaInvalidationPort } from "./application/ports/SchemaInvalidationPort.js";
export { SystemSeedPort } from "./application/ports/SystemSeedPort.js";
export {
  EntitySubtreeQueryPort,
  SubtreeEntityDto,
  SubtreeCursor,
  EntitySubtreeQueryParams,
  EntitySubtreePaginatedResult,
} from "./application/ports/EntitySubtreeQueryPort.js";
export type {
  AdminContentCatalogPage,
  AdminContentCatalogPageParams,
  AdminContentCatalogQueryPort,
  AdminContentCatalogSortDirection,
  AdminContentCatalogSortKey,
  RecycleBinOperationItem,
  AdminEntityCatalogItem,
  AdminNodeCatalogItem,
} from "./application/ports/AdminContentCatalogQueryPort.js";

// ─── Application Services ────────────────────────────────────────────────────
export { AuthApplicationService } from "./application/services/AuthApplicationService.js";
export { HumanActivityService } from "./application/services/HumanActivityService.js";
export type {
  ActivityLockRef,
  HumanActivityResult,
} from "./application/services/HumanActivityService.js";
export { NodeApplicationService } from "./application/services/NodeApplicationService.js";
export { EntityApplicationService } from "./application/services/EntityApplicationService.js";
export { TypeAdminApplicationService } from "./application/services/TypeAdminApplicationService.js";
export { LockService } from "./application/services/LockService.js";
export { ScopedUserProvisioningService } from "./application/services/ScopedUserProvisioningService.js";
export { MfaTotpApplicationService } from "./application/services/MfaTotpApplicationService.js";
export { AttachmentCleanupService, ATTACHMENT_UPLOAD_STAGING_MS } from "./application/services/AttachmentCleanupService.js";

// ─── Infrastructure (PostgreSQL & Compilers) ──────────────────────────────────
export { PgExecutor } from "./infrastructure/postgres/PgExecutor.js";
export { PgTransactionContext } from "./infrastructure/postgres/PgTransactionContext.js";
export { TransactionPortPostgres } from "./infrastructure/postgres/TransactionPortPostgres.js";
export { NodeRepositoryPostgres } from "./infrastructure/postgres/NodeRepositoryPostgres.js";
export { NodeTypeRepositoryPostgres } from "./infrastructure/postgres/NodeTypeRepositoryPostgres.js";
export { EntityRepositoryPostgres } from "./infrastructure/postgres/EntityRepositoryPostgres.js";
export { EntityTypeRepositoryPostgres } from "./infrastructure/postgres/EntityTypeRepositoryPostgres.js";
export { TypeDefinitionReaderPostgres } from "./infrastructure/postgres/TypeDefinitionReaderPostgres.js";
export { TypeDefinitionAdminRepositoryPostgres } from "./infrastructure/postgres/TypeDefinitionAdminRepositoryPostgres.js";
export { StorageTableManagementPostgres } from "./infrastructure/postgres/StorageTableManagementPostgres.js";
export { SystemSeedPostgres } from "./infrastructure/postgres/SystemSeedPostgres.js";
export { AuditPortPostgres } from "./infrastructure/postgres/AuditPortPostgres.js";
export { LoginRateLimitPortPostgres } from "./infrastructure/postgres/LoginRateLimitPortPostgres.js";
export { AccountActionTokenPortPostgres } from "./infrastructure/postgres/AccountActionTokenPortPostgres.js";
export { MfaTotpPortPostgres } from "./infrastructure/postgres/MfaTotpPortPostgres.js";
export { AccountRecoveryApplicationService } from "./application/services/AccountRecoveryApplicationService.js";
export { AccountActionDeliveryDrainer } from "./application/services/AccountActionDeliveryDrainer.js";
export { AccountActionTokenCipherAesGcm } from "./infrastructure/crypto/AccountActionTokenCipherAesGcm.js";
export { AccountActionDeliveryOutboxPostgres } from "./infrastructure/postgres/AccountActionDeliveryOutboxPostgres.js";
export { AccountActionDeliveryOutboxSqlite } from "./infrastructure/sqlite/AccountActionDeliveryOutboxSqlite.js";
export { RevisionPortPostgres } from "./infrastructure/postgres/RevisionPortPostgres.js";
export { LockRepositoryPostgres } from "./infrastructure/postgres/LockRepositoryPostgres.js";
export { PusherEventBus } from "./infrastructure/pusher/PusherEventBus.js";
export { RuntimeConfigurationPortPostgres } from "./infrastructure/postgres/RuntimeConfigurationPortPostgres.js";
export { AccessControlPortPostgres } from "./infrastructure/postgres/AccessControlPortPostgres.js";
export { EntitySubtreeQueryPortPostgres } from "./infrastructure/postgres/EntitySubtreeQueryPortPostgres.js";
export { AdminContentCatalogQueryPortPostgres } from "./infrastructure/postgres/AdminContentCatalogQueryPortPostgres.js";

export { FieldSchemaCompiler } from "./infrastructure/schema/FieldSchemaCompiler.js";
export { CachingSchemaRegistry } from "./infrastructure/schema/CachingSchemaRegistry.js";
export { EntitySchemaRegistryBridge } from "./infrastructure/schema/EntitySchemaRegistryBridge.js";
export { SchemaInvalidationAdapter } from "./infrastructure/schema/SchemaInvalidationAdapter.js";
export { SessionRepositoryPostgres } from "./infrastructure/postgres/SessionRepositoryPostgres.js";
export { RealtimeScopeResolverPostgres } from "./infrastructure/postgres/RealtimeScopeResolverPostgres.js";
export {
  canonicalizeRealtimeRules,
  createRealtimeChannelPolicy,
  getRealtimeDataChannelName,
  getRealtimeLockChannelName,
  policyAllowsResource,
} from "./application/realtime/RealtimeChannelPolicy.js";
export type {
  RealtimeChannelPolicy,
  RealtimeChannelRule,
  RealtimeResourceScope,
} from "./application/realtime/RealtimeChannelPolicy.js";
export { PusherTransport } from "./infrastructure/pusher/PusherTransport.js";
export type { PusherTransportPort } from "./infrastructure/pusher/PusherTransport.js";
export { RealtimeChannelRouter } from "./infrastructure/pusher/RealtimeChannelRouter.js";
export { MemoryCache } from "./application/cache/MemoryCache.js";

export { User } from "./domain/models/User.js";
export { Role } from "./domain/models/Role.js";

export {
  UserNotFoundError,
  UserEmailAlreadyExistsError,
  UserAdminValidationError,
} from "./domain/errors/UserAdminErrors.js";

export {
  RoleNotFoundError,
  RoleKeyAlreadyExistsError,
  SystemRoleForbiddenError,
  SecurityAdminValidationError,
} from "./domain/errors/SecurityAdminErrors.js";

export {
  UserRoleDto,
  UserListItemDto,
  UserListPageParams,
  UserListPageDto,
  UserDetailDto,
  CreateUserUiCommand,
  UpdateUserStatusUiCommand,
  AssignUserRolesUiCommand,
  UpdateUserUiCommand,
  ResetUserPasswordUiCommand,
} from "./application/dto/UserAdminDtos.js";

export {
  PermissionDto,
  RoleListItemDto,
  RoleListPageDto,
  RoleListPageParams,
  RoleDetailDto,
  ScopeAssignmentDto,
  ScopeAssignmentListPageDto,
  ScopeAssignmentListPageParams,
  RevokedDelegatedScopeAssignmentDto,
  RealtimeScopeAssignmentDto,
  CreateRoleUiCommand,
  UpdateRolePermissionsUiCommand,
  UpdateRoleMetadataUiCommand,
  UpdateRoleUiCommand,
  CreateScopeAssignmentUiCommand,
  DeleteScopeAssignmentUiCommand,
  UpdateScopeAssignmentUiCommand,
} from "./application/dto/SecurityAdminDtos.js";

export {
  CreateUserCommand,
  CreateUserCommandSchema,
  UpdateUserStatusCommand,
  UpdateUserStatusCommandSchema,
  AssignUserRolesCommand,
  AssignUserRolesCommandSchema,
  UpdateUserCommand,
  UpdateUserCommandSchema,
  ResetUserPasswordCommand,
  ResetUserPasswordCommandSchema,
  UserPasswordSchema,
} from "./application/commands/UserAdminCommands.js";
export {
  CreateScopedUserCommand,
  CreateScopedUserCommandSchema,
} from "./application/commands/ScopedUserCommands.js";

export {
  CreateRoleCommand,
  CreateRoleCommandSchema,
  UpdateRolePermissionsCommand,
  UpdateRolePermissionsCommandSchema,
  UpdateRoleMetadataCommand,
  UpdateRoleMetadataCommandSchema,
  UpdateRoleCommand,
  UpdateRoleCommandSchema,
  CreateScopeAssignmentCommand,
  CreateScopeAssignmentCommandSchema,
  DeleteScopeAssignmentCommand,
  DeleteScopeAssignmentCommandSchema,
  UpdateScopeAssignmentCommand,
  UpdateScopeAssignmentCommandSchema,
} from "./application/commands/SecurityAdminCommands.js";

export { UserRepository } from "./application/ports/UserRepository.js";
export { UserAdminApplicationService } from "./application/services/UserAdminApplicationService.js";
export { UserRepositoryPostgres } from "./infrastructure/postgres/UserRepositoryPostgres.js";

export { SecurityRepository } from "./application/ports/SecurityRepository.js";
export { SecurityAdminApplicationService } from "./application/services/SecurityAdminApplicationService.js";
export { SecurityRepositoryPostgres } from "./infrastructure/postgres/SecurityRepositoryPostgres.js";

export {
  PlacementPolicyNotFoundError,
  PlacementPolicyKeyAlreadyExistsError,
  SystemConfigValidationError,
} from "./domain/errors/SystemAdminErrors.js";

export {
  CapabilityStatus,
  SettingValueType,
  PolicyMode,
  RuleType,
  RuntimeCapabilityDto,
  SystemSettingDto,
  PlacementPolicyRuleDto,
  PlacementPolicyListItemDto,
  PlacementPolicyDetailDto,
  UpdateCapabilityStatusUiCommand,
  UpdateSystemSettingUiCommand,
  CreatePlacementPolicyUiCommand,
  UpdatePlacementPolicyUiCommand,
  DeletePlacementPolicyUiCommand,
  CreatePlacementRuleUiCommand,
  DeletePlacementRuleUiCommand,
} from "./application/dto/SystemConfigDtos.js";

export {
  UpdateCapabilityStatusCommand,
  UpdateCapabilityStatusCommandSchema,
  UpdateSystemSettingCommand,
  UpdateSystemSettingCommandSchema,
  CreatePlacementPolicyCommand,
  CreatePlacementPolicyCommandSchema,
  UpdatePlacementPolicyCommand,
  UpdatePlacementPolicyCommandSchema,
  DeletePlacementPolicyCommand,
  DeletePlacementPolicyCommandSchema,
  CreatePlacementRuleCommand,
  CreatePlacementRuleCommandSchema,
  DeletePlacementRuleCommand,
  DeletePlacementRuleCommandSchema,
} from "./application/commands/SystemConfigCommands.js";

export { SystemConfigRepository } from "./application/ports/SystemConfigRepository.js";
export { SystemAdminApplicationService } from "./application/services/SystemAdminApplicationService.js";
export { SystemConfigRepositoryPostgres } from "./infrastructure/postgres/SystemConfigRepositoryPostgres.js";

export { LtreeNodePathPolicy } from "./domain/policies/LtreeNodePathPolicy.js";
export { NodePathPolicy } from "./domain/policies/NodePathPolicy.js";

export {
  AuditLogListItemDto,
  AuditLogDetailDto,
  AuditFilterCatalogDto,
  AuditLogFilterDto,
  PaginatedResultDto,
} from "./application/dto/AuditQueryDtos.js";
export { AuditQueryPort } from "./application/ports/AuditQueryPort.js";
export { AuditAdminApplicationService } from "./application/services/AuditAdminApplicationService.js";
export { AuditQueryPortPostgres } from "./infrastructure/postgres/AuditQueryPortPostgres.js";
export { SqliteDatabase } from "./infrastructure/sqlite/SqliteDatabase.js";
export { TransactionPortSqlite } from "./infrastructure/sqlite/TransactionPortSqlite.js";
export { ensureSqliteSchema } from "./infrastructure/sqlite/SqliteSchema.js";
export { NodeRepositorySqlite } from "./infrastructure/sqlite/NodeRepositorySqlite.js";
export { LockRepositorySqlite } from "./infrastructure/sqlite/LockRepositorySqlite.js";
export { NodeTypeRepositorySqlite } from "./infrastructure/sqlite/NodeTypeRepositorySqlite.js";
export { EntityTypeRepositorySqlite } from "./infrastructure/sqlite/EntityTypeRepositorySqlite.js";
export { EntityRepositorySqlite } from "./infrastructure/sqlite/EntityRepositorySqlite.js";
export { AccessControlPortSqlite } from "./infrastructure/sqlite/AccessControlPortSqlite.js";
export { AuditPortSqlite } from "./infrastructure/sqlite/AuditPortSqlite.js";
export { ConfigurationRepositorySqlite } from "./infrastructure/sqlite/ConfigurationRepositorySqlite.js";
export { RuntimeConfigurationPortSqlite } from "./infrastructure/sqlite/RuntimeConfigurationPortSqlite.js";
export { SessionRepositorySqlite } from "./infrastructure/sqlite/SessionRepositorySqlite.js";
export { LoginRateLimitPortSqlite } from "./infrastructure/sqlite/LoginRateLimitPortSqlite.js";
export { AccountActionTokenPortSqlite } from "./infrastructure/sqlite/AccountActionTokenPortSqlite.js";
export { UserRepositorySqlite } from "./infrastructure/sqlite/UserRepositorySqlite.js";
export { RevisionPortSqlite } from "./infrastructure/sqlite/RevisionPortSqlite.js";
export { RealtimeOutboxSqlite } from "./infrastructure/sqlite/RealtimeOutboxSqlite.js";
export { WorkflowRepositorySqlite } from "./infrastructure/sqlite/WorkflowRepositorySqlite.js";
export { WorkflowRepositoryPostgres } from "./infrastructure/postgres/WorkflowRepositoryPostgres.js";
export { SqliteInfrastructure } from "./infrastructure/sqlite/SqliteInfrastructure.js";
export { StorageTableManagementSqlite } from "./infrastructure/sqlite/StorageTableManagementSqlite.js";
export type {
  AttachmentRecord,
  AttachmentRepository,
} from "./application/ports/AttachmentRepository.js";
export { AttachmentRepositoryPostgres } from "./infrastructure/postgres/AttachmentRepositoryPostgres.js";
export { AttachmentRepositorySqlite } from "./infrastructure/sqlite/AttachmentRepositorySqlite.js";
export { AttachmentCleanupPortPostgres } from "./infrastructure/postgres/AttachmentCleanupPortPostgres.js";
export { AttachmentCleanupPortSqlite } from "./infrastructure/sqlite/AttachmentCleanupPortSqlite.js";
export type { AttachmentRateLimitPort } from "./application/ports/AttachmentRateLimitPort.js";
export { AttachmentRateLimitPortPostgres } from "./infrastructure/postgres/AttachmentRateLimitPortPostgres.js";
export { AttachmentRateLimitPortSqlite } from "./infrastructure/sqlite/AttachmentRateLimitPortSqlite.js";
export type {
  AttachmentEncryptionMode,
  AttachmentPolicyRepository,
} from "./application/ports/AttachmentPolicyRepository.js";
export { AttachmentPolicyRepositoryPostgres } from "./infrastructure/postgres/AttachmentPolicyRepositoryPostgres.js";
export { AttachmentPolicyRepositorySqlite } from "./infrastructure/sqlite/AttachmentPolicyRepositorySqlite.js";
export type {
  PurgeTargetResult,
  ResourcePurgeRepository,
} from "./application/ports/ResourcePurgeRepository.js";
export { ResourcePurgeRepositoryPostgres } from "./infrastructure/postgres/ResourcePurgeRepositoryPostgres.js";
export { ResourcePurgeRepositorySqlite } from "./infrastructure/sqlite/ResourcePurgeRepositorySqlite.js";
export { TypeDefinitionReaderSqlite } from "./infrastructure/sqlite/TypeDefinitionReaderSqlite.js";
export { MfaTotpPortSqlite } from "./infrastructure/sqlite/MfaTotpPortSqlite.js";
