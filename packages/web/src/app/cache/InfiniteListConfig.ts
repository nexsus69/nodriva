/**
 * Default configuration for windowed infinite lists.
 *
 * This is intentionally kept in one place so it can later be replaced by a
 * runtime/database-backed configuration without changing the consumers.
 */
export const INFINITE_LIST_CONFIG = {
  // La finestra minima deve contenere più righe dell'altezza scrollabile della
  // tabella: con 25 elementi per pagina e 4 pagine otteniamo 100 elementi.
  // Se il totale non supera lo spazio disponibile, la sentinella inferiore
  // resta nel viewport e la lista infinita non può avanzare correttamente.
  pageSize: 25,
  maxWindowPages: 4,
} as const;
