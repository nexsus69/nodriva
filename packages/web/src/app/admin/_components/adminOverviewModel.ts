/** Derives actionable administration dashboard summaries from authorized read models. */
import type {
  AuditLogListItemDto,
  RuntimeCapabilityDto,
  TypeListItemDto,
  WorkflowDefinition,
} from "@dashboard/core";

export interface AdminOverviewSummary {
  requiredCapabilityGaps: RuntimeCapabilityDto[];
  enabledCapabilityCount: number;
  activeWorkflowCount: number;
  activeNodeTypeCount: number;
  activeEntityTypeCount: number;
  recentAuditRecords: AuditLogListItemDto[];
}

/** Keeps only configuration deviations that disable a capability required by default. */
export function requiredCapabilityGaps(
  capabilities: readonly RuntimeCapabilityDto[],
): RuntimeCapabilityDto[] {
  return capabilities.filter((capability) =>
    capability.defaultStatus === "enabled" && capability.currentStatus === "disabled",
  );
}

/** Produces stable dashboard counts without turning optional configuration into an alert. */
export function summarizeAdminOverview(input: {
  capabilities: readonly RuntimeCapabilityDto[];
  workflows: readonly WorkflowDefinition[];
  nodeTypes: readonly TypeListItemDto[];
  entityTypes: readonly TypeListItemDto[];
  auditRecords: readonly AuditLogListItemDto[];
}): AdminOverviewSummary {
  return {
    requiredCapabilityGaps: requiredCapabilityGaps(input.capabilities),
    enabledCapabilityCount: input.capabilities.filter((capability) => capability.currentStatus === "enabled").length,
    activeWorkflowCount: input.workflows.filter((workflow) => workflow.isActive).length,
    activeNodeTypeCount: input.nodeTypes.filter((type) => type.isActive).length,
    activeEntityTypeCount: input.entityTypes.filter((type) => type.isActive).length,
    recentAuditRecords: input.auditRecords.slice(0, 5),
  };
}
