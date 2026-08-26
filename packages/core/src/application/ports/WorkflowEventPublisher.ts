/** Declares the generic post-mutation event publication boundary used by application services. */
import type { WorkflowEvent } from '../../domain/events/WorkflowEvent.js';

export interface WorkflowEventPublisher {
  publish(event: WorkflowEvent): Promise<void>;
}
