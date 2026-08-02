import { ApiErrorResponse, AppError } from '@dashboard/core';

/**
 * Errori di sicurezza esposti alle Server Actions senza trasformare un
 * rifiuto autorizzativo in un generico errore interno.
 */
export function mapAuthorizationError(error: unknown): ApiErrorResponse | null {
  if (!(error instanceof AppError)) return null;

  if (error.code === 'ACCESS_FORBIDDEN') {
    return {
      code: 'ACCESS_FORBIDDEN',
      message: 'Non disponi dei permessi necessari per accedere a questa sezione.',
    };
  }

  if (error.code === 'AUTH_UNAUTHORIZED') {
    return {
      code: 'AUTH_UNAUTHORIZED',
      message: 'La sessione non è valida o è scaduta. Effettua nuovamente il login.',
    };
  }

  return null;
}
