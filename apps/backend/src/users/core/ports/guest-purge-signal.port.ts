export const GUEST_PURGE_SIGNAL = Symbol("GUEST_PURGE_SIGNAL");

export interface GuestPurgeSignal {
  report(error: unknown, properties: Record<string, unknown>): void;
}
