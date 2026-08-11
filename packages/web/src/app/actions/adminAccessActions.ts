'use server';

import { accessControlPort } from '../../server/db';
import { AuthResolver } from './auth/AuthResolver';

// L'accesso alla console richiede almeno una capacità amministrativa globale.
// Le singole pagine continuano comunque a verificare il permesso specifico.
const ADMIN_PERMISSIONS = [
  'user.read',
  'role.read',
  'scope.read',
  'audit.access',
  'system.config.read',
] as const;

export async function checkAdminAccessAction(): Promise<boolean> {
  try {
    const actorUserId = await AuthResolver.resolveActorUserId();
    for (const permission of ADMIN_PERMISSIONS) {
      try {
        await accessControlPort.assertHasPermission(actorUserId, permission, null);
        return true;
      } catch {
        // L'utente può possedere una sola delle capacità amministrative.
      }
    }
  } catch {
    return false;
  }
  return false;
}
