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

export const GUEST_PURGE_BATCH_SIZE = 100;
export const GUEST_PURGE_BUDGET_MS = 5 * 60 * 1000;

export interface GuestPurgeCursor {
  id: string;
}

export interface GuestPurgeBatch {
  /** The last account the batch saw, or null when nothing expired is left after the cursor. */
  cursor: GuestPurgeCursor | null;
  seen: number;
  deletedIds: string[];
  /** A RESTRICT row keeps the account; someone has to look. */
  blocked: { userId: string; error: unknown }[];
  /** A lock wait ran out; the next night retries the account. */
  deferred: string[];
}

export interface GuestPurgeResult {
  deleted: number;
  blocked: number;
  deferred: number;
  batches: number;
  rateLimitRowsDeleted: number;
  /** False when the run stopped on its time budget with expired accounts left. */
  complete: boolean;
}
