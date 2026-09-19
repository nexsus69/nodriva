'use server';

/** Exposes the authorized, page-bounded administrative node and entity catalogues. */
import type { AdminContentCatalogPageParams } from '@dashboard/core';
import { AuthResolver } from './auth/AuthResolver';
import { withSafeActionErrors } from './errorMapping';

export interface AdminContentCatalogueRequest {
  page: number;
  pageSize: number;
  search?: string;
  sort?: AdminContentCatalogPageParams['sort'];
}

function validate(input: AdminContentCatalogueRequest): AdminContentCatalogueRequest {
  if (!Number.isInteger(input.page) || input.page < 1) throw new Error('Pagina non valida');
  if (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 100) throw new Error('Dimensione pagina non valida');
  if (input.search && input.search.length > 200) throw new Error('Ricerca troppo lunga');
  if (input.sort && !['path', 'name', 'type'].includes(input.sort.key)) throw new Error('Ordinamento non valido');
  if (input.sort && !['ascending', 'descending'].includes(input.sort.direction)) throw new Error('Direzione ordinamento non valida');
  return input;
}

export async function listAdminNodesPageAction(input: AdminContentCatalogueRequest) {
  return withSafeActionErrors(async () => {
    const { adminContentCatalogQueryPort } = await import('../../server/db');
    return adminContentCatalogQueryPort.findNodesPage({ ...validate(input), actorUserId: await AuthResolver.resolveActorUserId() });
  });
}

export async function listAdminEntitiesPageAction(input: AdminContentCatalogueRequest) {
  return withSafeActionErrors(async () => {
    const { adminContentCatalogQueryPort } = await import('../../server/db');
    return adminContentCatalogQueryPort.findEntitiesPage({ ...validate(input), actorUserId: await AuthResolver.resolveActorUserId() });
  });
}

/** Reads one ACL-authoritative, causally grouped recycle-bin page. */
export async function listRecycleBinPageAction(input: Pick<AdminContentCatalogueRequest, 'page' | 'pageSize'>) {
  return withSafeActionErrors(async () => {
    const { adminContentCatalogQueryPort } = await import('../../server/db');
    return adminContentCatalogQueryPort.findRecycleBinPage({ ...validate(input), actorUserId: await AuthResolver.resolveActorUserId() });
  });
}

/** Returns only the ACL-filtered summary required to reconcile a node realtime notice. */
export async function getAdminNodeSummaryAction(nodeId: string) {
  return withSafeActionErrors(async () => {
    if (!nodeId.trim()) throw new Error('Nodo non valido');
    const { adminContentCatalogQueryPort } = await import('../../server/db');
    return adminContentCatalogQueryPort.findNodeSummary(await AuthResolver.resolveActorUserId(), nodeId);
  });
}

/** Returns only the ACL-filtered summary required to reconcile an entity realtime notice. */
export async function getAdminEntitySummaryAction(entityId: string) {
  return withSafeActionErrors(async () => {
    if (!entityId.trim()) throw new Error('Entità non valida');
    const { adminContentCatalogQueryPort } = await import('../../server/db');
    return adminContentCatalogQueryPort.findEntitySummary(await AuthResolver.resolveActorUserId(), entityId);
  });
}
