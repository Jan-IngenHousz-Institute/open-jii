export const GUEST_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface GuestIdentity {
  id: string;
  isAnonymous: boolean;
  createdAt: Date;
}

export type GuestQuotaKind = "upload" | "macro";

export interface GuestQuotaDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface GuestPurgeResult {
  skipped: boolean;
  deleted: number;
  rateLimitRowsDeleted: number;
}
