/** Decides one administrative node query's cache impact from its actual descriptor. */
import type { AdminNodeCatalogItem } from '@dashboard/core';

export interface AdminNodeQueryDescriptor {
  familyKey: string;
  search?: string;
  /** Fields emitted by the backend ORDER BY, including stable tie breakers. */
  orderFields: readonly AdminNodeOrderField[];
}

export type AdminNodeOrderField = Extract<keyof AdminNodeCatalogItem, string>;
export type AdminNodeQueryImpact = 'no-effect' | 'patch-record' | 'invalidate-family';

/** Owns the query-specific proof that a changed summary preserves membership and stable ordering. */
export class AdminNodeQueryImpactPolicy {
  public decide(previous: AdminNodeCatalogItem | null, current: AdminNodeCatalogItem | null, query: AdminNodeQueryDescriptor): AdminNodeQueryImpact {
    const wasMember = previous ? this.matches(previous, query) : false;
    const isMember = current ? this.matches(current, query) : false;
    if (!wasMember && !isMember) return 'no-effect';
    if (wasMember !== isMember || !previous || !current) return 'invalidate-family';
    const before = this.orderTuple(previous, query);
    const after = this.orderTuple(current, query);
    return before.every((value, index) => value === after[index]) ? 'patch-record' : 'invalidate-family';
  }

  private matches(item: AdminNodeCatalogItem, query: AdminNodeQueryDescriptor): boolean {
    const search = query.search?.trim().toLocaleLowerCase();
    if (!search) return true;
    return [item.name, item.path, item.typeLabel].some((value) => value.toLocaleLowerCase().includes(search));
  }

  private orderTuple(item: AdminNodeCatalogItem, query: AdminNodeQueryDescriptor): readonly unknown[] {
    return query.orderFields.map((field) => item[field]);
  }
}
