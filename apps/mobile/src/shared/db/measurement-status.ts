// Measurement status vocabulary, deliberately free of the DB client: feature
// code (and the jsdom hook tests) can import these without measurements-storage
// pulling expo-sqlite in at module load. Re-exported from measurements-storage.

export type MeasurementStatus = "pending" | "failed" | "successful";

// A measurement the cloud hasn't acknowledged yet: still editable
// (comments/flags) and eligible for (re-)upload.
export const UNSYNCED_STATUSES: readonly MeasurementStatus[] = ["pending", "failed"];

export function isUnsynced(status: MeasurementStatus): boolean {
  return UNSYNCED_STATUSES.includes(status);
}
