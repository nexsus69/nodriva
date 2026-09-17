/** Decides one administrative entity query's cache impact from its actual descriptor. */
import type { AdminEntityCatalogItem } from '@dashboard/core';

export interface AdminEntityQueryDescriptor {
  familyKey: string;
  search?: string;
  /** Fields emitted by the backend ORDER BY, including stable tie breakers. */
  orderFields: readonly AdminEntityOrderField[];
}

export type AdminEntityOrderField = Extract<keyof AdminEntityCatalogItem, string>;

export type AdminEntityQueryImpact = 'no-effect' | 'patch-record' | 'invalidate-family';

/** Owns the query-specific proof that a changed summary preserves membership and stable ordering. */
export class AdminEntityQueryImpactPolicy {
  public decide(previous: AdminEntityCatalogItem | null, current: AdminEntityCatalogItem | null, query: AdminEntityQueryDescriptor): AdminEntityQueryImpact {
    const wasMember = previous ? this.matches(previous, query) : false;
    const isMember = current ? this.matches(current, query) : false;
    if (!wasMember && !isMember) return 'no-effect';
    if (wasMember !== isMember || !previous || !current) return 'invalidate-family';
    return this.orderTuple(previous, query).every((value, index) => value === this.orderTuple(current, query)[index])
      ? 'patch-record'
      : 'invalidate-family';
  }

  private matches(item: AdminEntityCatalogItem, query: AdminEntityQueryDescriptor): boolean {
    const search = query.search?.trim().toLocaleLowerCase();
    if (!search) return true;
    return [item.name, item.nodePath, item.typeLabel].some((value) => value.toLocaleLowerCase().includes(search));
  }

  private orderTuple(item: AdminEntityCatalogItem, query: AdminEntityQueryDescriptor): readonly unknown[] {
    // Direction does not affect whether a changed tuple can cross a retained
    // page boundary; the actual fields and tie breakers are in the descriptor.
    return query.orderFields.map((field) => item[field]);
  }
}
