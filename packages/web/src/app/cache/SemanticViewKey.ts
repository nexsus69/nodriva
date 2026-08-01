export interface SemanticViewKeyParams {
  viewType: 'SUBTREE_LIST' | 'ENTITY_DETAIL' | 'BREADCRUMB' | 'NODE_CHILDREN_LIST' | 'NODE_ENTITY_COLLECTION' | 'METADATA_LIST';
  baseNodeId?: string;
  entityId?: string;
  search?: string;
  entityTypeId?: string;
  metadataType?: 'node' | 'entity';
  filters?: Record<string, unknown>;
  sort?: Record<string, unknown>;
}

export class ViewKeyBuilder {
  private static stableSerialize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableSerialize(item)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.stableSerialize(record[key])}`)
      .join(',')}}`;
  }

  static build(params: SemanticViewKeyParams): string {
    const parts: string[] = [params.viewType];
    
    if (params.baseNodeId) parts.push(`baseNodeId:${params.baseNodeId}`);
    if (params.entityId) parts.push(`entityId:${params.entityId}`);
    if (params.search) parts.push(`search:${params.search}`);
    if (params.entityTypeId) parts.push(`entityTypeId:${params.entityTypeId}`);
    if (params.metadataType) parts.push(`metadataType:${params.metadataType}`);
    
    if (params.filters) {
      parts.push(`filters:${this.stableSerialize(params.filters)}`);
    }

    if (params.sort) {
      parts.push(`sort:${this.stableSerialize(params.sort)}`);
    }

    return parts.join('|');
  }
}
