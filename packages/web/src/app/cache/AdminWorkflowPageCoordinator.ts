/** Owns normalized bounded windows for the administrative workflow catalogue. */
import type { WorkflowDefinition, WorkflowDefinitionListPageDto, WorkflowDefinitionListPageParams } from '@dashboard/core';
import { CacheKernel } from './CacheKernel';
import { PagedWindowCoordinator } from './PagedWindowCoordinator';

const FAMILY = 'admin-workflow-page:';
const NAMESPACE = 'admin-workflow';

export class AdminWorkflowPageCoordinator {
  private readonly windows: PagedWindowCoordinator<WorkflowDefinitionListPageParams, string, WorkflowDefinitionListPageDto>;

  public constructor(private readonly kernel: CacheKernel, load: (input: WorkflowDefinitionListPageParams) => Promise<WorkflowDefinitionListPageDto>, private readonly verify: () => Promise<boolean>) {
    this.windows = new PagedWindowCoordinator(load, (input, page, key) => {
      page.items.forEach((item) => kernel.upsertRecord(NAMESPACE, { ...item, id: `${item.workflowId}@${item.version}` }, { completeness: 'summary' }));
      return { key, descriptor: this.descriptor(input), references: page.items.map((item) => ({ namespace: NAMESPACE, id: `${item.workflowId}@${item.version}` })), page: page.page, pageCount: page.pageCount, total: page.total };
    }, (window) => this.release(window));
  }

  public async read(input: WorkflowDefinitionListPageParams): Promise<WorkflowDefinitionListPageDto> {
    const key = `${FAMILY}${input.page}:${this.descriptor(input)}`;
    const cached = this.windows.get(key);
    if (cached && await this.verify()) return this.resolve(cached);
    if (cached) this.windows.remove(key);
    return this.windows.read(key, input);
  }
  public invalidateFamily(): void { this.windows.invalidate(); }
  public purge(): void { this.invalidateFamily(); }
  private descriptor(input: WorkflowDefinitionListPageParams): string { return `${input.pageSize}:${input.search?.trim().toLocaleLowerCase() ?? ''}:${input.sort ? `${input.sort.key}:${input.sort.direction}` : 'workflowId:ascending'}`; }
  private resolve(window: { references: readonly { namespace: string; id: string }[]; page: number; pageCount: number; total: number }): WorkflowDefinitionListPageDto {
    return { items: window.references.flatMap((reference) => { const item = this.kernel.getRecord<WorkflowDefinition & { id: string }>(reference.namespace, reference.id); return item ? [{ ...item }] : []; }), page: window.page, pageCount: window.pageCount, total: window.total };
  }
  private release(window: { references: readonly { namespace: string; id: string }[] } | null): void { window?.references.forEach((reference) => { if (!this.windows.index.hasWindowsFor(reference)) this.kernel.removeRecord(reference.namespace, reference.id); }); }
}
