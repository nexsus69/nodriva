import Link from 'next/link';
import type { ClientEntity, EntityTypeMeta } from '../../../types/models';
import { EntityResourceMenu } from '../../../components/ui/menu';

interface EntityFieldDefinition {
  fieldKey: string;
  label?: string | null;
  dataType: string;
  enumOptions?: readonly { value: string; label: string }[];
}

export interface NodeEntityGridProps {
  nodeId: string;
  entities: readonly ClientEntity[];
  entityTypes: Readonly<Record<string, EntityTypeMeta>>;
  entityDefinitions: Readonly<Record<string, { fields: readonly EntityFieldDefinition[] }>>;
}

export function NodeEntityGrid({ nodeId, entities, entityTypes, entityDefinitions }: NodeEntityGridProps) {
  const entitiesById = Object.fromEntries(entities.map((entity) => [entity.id, entity]));

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {entities.map((entity) => {
        const entityType = Object.values(entityTypes).find(
          (type) => type.id === entity.entityTypeId || type.typeKey === entity.entityTypeId,
        );
        const definition = entityType ? entityDefinitions[entityType.typeKey] : undefined;
        const fieldsByKey = Object.fromEntries((definition?.fields ?? []).map((field) => [field.fieldKey, field]));
        const preview = Object.entries(entity.payload ?? {})
          .filter(([, value]) => value !== null && value !== '')
          .slice(0, 3)
          .map(([key, value]) => {
            const field = fieldsByKey[key];
            const enumLabel = field?.enumOptions?.find((option) => option.value === String(value))?.label;
            const relatedEntity = field?.dataType.toLowerCase() === 'relation' && typeof value === 'string'
              ? entitiesById[value]
              : undefined;
            return {
              key,
              label: field?.label ?? key,
              value: enumLabel ?? relatedEntity?.name ?? String(value),
            };
          });
        const entityHref = `/nodes/${nodeId}/entities/${entity.id}`;

        return (
          <div key={entity.id} className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Link href={entityHref} className="min-w-0 truncate text-sm font-semibold text-slate-800 hover:text-indigo-600">{entity.name}</Link>
                <EntityResourceMenu entityId={entity.id} entityName={entity.name} parentNodeId={nodeId} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-mono text-slate-500">{entityType?.name ?? entity.entityTypeId}</span>
              </div>
            </div>
            <Link href={entityHref} className="block">
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">{entity.description || 'Nessuna descrizione.'}</p>
              {preview.length > 0 && (
                <dl className="mt-3 grid grid-cols-1 gap-1 border-t border-slate-100 pt-3 text-[11px]">
                  {preview.map((item) => (
                    <div key={item.key} className="flex min-w-0 justify-between gap-2">
                      <dt className="truncate text-slate-400">{item.label}</dt>
                      <dd className="truncate text-slate-600">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
