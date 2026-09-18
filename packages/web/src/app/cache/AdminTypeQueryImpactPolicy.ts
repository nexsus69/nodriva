/** Decides one administrative type query's cache impact from its actual descriptor. */
import type { TypeListItemDto } from '@dashboard/core';

export interface AdminTypeQueryDescriptor {
  familyKey: string;
  search?: string;
  orderFields: readonly AdminTypeOrderField[];
}

export type AdminTypeOrderField = Extract<keyof TypeListItemDto, string>;
export type AdminTypeQueryImpact = 'no-effect' | 'patch-record' | 'invalidate-family';

/** Owns the proof that a changed type preserves membership and stable ordering. */
export class AdminTypeQueryImpactPolicy {
  public decide(previous: TypeListItemDto | null, current: TypeListItemDto | null, query: AdminTypeQueryDescriptor): AdminTypeQueryImpact {
    const wasMember = previous ? this.matches(previous, query) : false;
    const isMember = current ? this.matches(current, query) : false;
    if (!wasMember && !isMember) return 'no-effect';
    if (wasMember !== isMember || !previous || !current) return 'invalidate-family';
    const before = this.orderTuple(previous, query);
    const after = this.orderTuple(current, query);
    return before.every((value, index) => value === after[index]) ? 'patch-record' : 'invalidate-family';
  }

  private matches(item: TypeListItemDto, query: AdminTypeQueryDescriptor): boolean {
    const search = query.search?.trim().toLocaleLowerCase();
    if (!search) return true;
    return [item.name, item.typeKey, item.description].some((value) => value.toLocaleLowerCase().includes(search));
  }

  private orderTuple(item: TypeListItemDto, query: AdminTypeQueryDescriptor): readonly unknown[] {
    return query.orderFields.map((field) => item[field]);
  }
}
