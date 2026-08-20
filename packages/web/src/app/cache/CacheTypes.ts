export interface CacheWriteDiagnostic {
  timestamp: number;
  id: string;
  source: string;
  accepted: boolean;
  incomingVersion?: number;
  previousVersion?: number;
  incomingName?: string;
  resultingName?: string;
}
