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

function validationDetails(details: Record<string, unknown> | undefined): ApiErrorResponse['details'] {
  const issues = details?.issues;
  if (!issues || typeof issues !== 'object' || Array.isArray(issues)) return undefined;

  return Object.entries(issues as Record<string, unknown>).flatMap(([field, messages]) => {
    const values = Array.isArray(messages) ? messages : [messages];
    return values.map((message) => ({
      field,
      code: 'VALIDATION_FAILED',
      message: typeof message === 'string' ? message : 'Valore non valido.',
    }));
  });
}

/**
 * Single boundary mapper for every Server Action.
 * Domain errors may retain technical messages internally, but only this
 * function decides what is safe and stable to expose to the browser.
 */
export function mapAppErrorToApiErrorResponse(error: unknown): ApiErrorResponse {
  const authorizationError = mapAuthorizationError(error);
  if (authorizationError) return authorizationError;

  if (!(error instanceof AppError)) {
    console.error('[ErrorMapping] Unexpected non-domain error:', error);
    return {
      code: 'INTERNAL_ERROR',
      message: 'Si è verificato un errore interno. Riprova più tardi.',
    };
  }

  const details = error.details;
  switch (error.code) {
    case 'ROW_VERSION_MISMATCH':
      return {
        code: 'ROW_VERSION_MISMATCH',
        message: 'La risorsa è stata modificata da un altro utente. Ricarica la pagina.',
        expectedRowVersion: typeof details?.expected === 'number' ? details.expected : undefined,
        currentRowVersion: typeof details?.actual === 'number' ? details.actual : undefined,
      };
    case 'VALIDATION_FAILED':
    case 'TYPE_ADMIN_VALIDATION_FAILED':
    case 'SECURITY_ADMIN_VALIDATION_ERROR':
    case 'USER_ADMIN_VALIDATION_ERROR':
    case 'SYSTEM_CONFIG_VALIDATION_ERROR':
    case 'ENTITY_SCHEMA_VALIDATION_FAILED':
    case 'ENTITY_COMMAND_VALIDATION_FAILED':
      return { code: 'VALIDATION_ERROR', message: error.message, details: validationDetails(details) };
    case 'TYPE_KEY_ALREADY_EXISTS':
      return { code: 'DUPLICATE_TYPE_KEY', message: 'La chiave del tipo esiste già.', target: 'typeKey' };
    case 'TYPE_FIELD_KEY_ALREADY_EXISTS':
      return { code: 'DUPLICATE_FIELD_KEY', message: 'La chiave del campo esiste già.', target: 'fieldKey' };
    case 'TYPE_FIELD_COLUMN_NAME_ALREADY_EXISTS':
      return { code: 'DUPLICATE_COLUMN_NAME', message: 'Il nome della colonna esiste già.', target: 'columnName' };
    case 'USER_EMAIL_ALREADY_EXISTS':
      return { code: 'DUPLICATE_EMAIL', message: 'L’indirizzo email è già associato a un utente.', target: 'email' };
    case 'DUPLICATE_ROLE_KEY':
      return { code: 'DUPLICATE_ROLE_KEY', message: 'La chiave del ruolo esiste già.', target: 'roleKey' };
    case 'TYPE_DEFINITION_NOT_FOUND':
    case 'TYPE_FIELD_NOT_FOUND':
    case 'TYPE_FIELD_CONSTRAINT_NOT_FOUND':
    case 'ENTITY_NOT_FOUND':
    case 'ENTITY_TYPE_NOT_FOUND':
    case 'NODE_NOT_FOUND':
    case 'NODE_TYPE_NOT_FOUND':
    case 'ROLE_NOT_FOUND':
    case 'USER_NOT_FOUND':
    case 'PLACEMENT_POLICY_NOT_FOUND':
      return { code: 'NOT_FOUND', message: 'La risorsa richiesta non è stata trovata.' };
    case 'SYSTEM_TYPE_MODIFICATION_DENIED':
    case 'SYSTEM_ROLE_FORBIDDEN':
      return { code: 'SYSTEM_TYPE_FORBIDDEN', message: 'Questa risorsa di sistema non può essere modificata.' };
    case 'SYSTEM_FIELD_MODIFICATION_DENIED':
      return { code: 'SYSTEM_FIELD_FORBIDDEN', message: 'Questo campo di sistema non può essere modificato.' };
    case 'TYPE_HAS_INSTANCES':
      return { code: 'TYPE_HAS_INSTANCES', message: 'Impossibile modificare il tipo perché possiede istanze attive.' };
    case 'TYPE_FIELD_HAS_VALUES':
      return { code: 'TYPE_FIELD_HAS_VALUES', message: 'Impossibile eliminare il campo perché contiene valori esistenti.' };
    case 'UNSUPPORTED_FIELD_DATA_TYPE':
    case 'SCHEMA_COMPILATION_ERROR':
      return { code: 'VALIDATION_ERROR', message: 'La definizione dello schema non è valida.' };
    case 'NODE_PATH_COLLISION':
      return { code: 'NODE_PATH_COLLISION', message: 'Esiste già un nodo con lo stesso nome nella destinazione.' };
    case 'NODE_CYCLIC_MOVE':
      return { code: 'NODE_CYCLIC_MOVE', message: 'Lo spostamento creerebbe un ciclo nella gerarchia.' };
    case 'LOCK_CONFLICT':
      return { code: 'LOCK_CONFLICT', message: 'La risorsa è attualmente modificata da un’altra sessione.' };
    case 'LOCK_NOT_FOUND':
    case 'LOCK_EXPIRED':
      return { code: error.code, message: 'Il lock non è più valido. Ricarica la pagina.' };
    case 'LOCK_FORBIDDEN':
      return { code: 'LOCK_FORBIDDEN', message: 'Non puoi rilasciare il lock di questa risorsa.' };
    case 'LOCK_REQUIRED':
      return { code: 'LOCK_REQUIRED', message: 'È necessario acquisire il lock prima di modificare la risorsa.' };
    case 'CAPABILITY_DISABLED':
      return { code: 'CAPABILITY_DISABLED', message: 'Questa funzionalità è temporaneamente disabilitata.' };
    case 'DUPLICATE_PLACEMENT_POLICY_KEY':
      return { code: 'DUPLICATE_PLACEMENT_POLICY_KEY', message: 'La chiave della policy esiste già.', target: 'policyKey' };
    default:
      console.error('[ErrorMapping] Unmapped domain error:', { code: error.code, message: error.message, details });
      return { code: 'INTERNAL_ERROR', message: 'Si è verificato un errore interno. Riprova più tardi.' };
  }
}

/** Safe exception boundary for legacy actions that still return domain data directly. */
export async function withSafeActionErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const mapped = mapAppErrorToApiErrorResponse(error);
    const safeError = new Error(mapped.message);
    Object.assign(safeError, mapped);
    throw safeError;
  }
}
