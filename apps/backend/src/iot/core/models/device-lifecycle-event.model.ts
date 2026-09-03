/**
 * A row of centrum's clean_device_lifecycle_events as the warehouse returns
 * it: every field nullable because silver normalizes but never fabricates.
 * Shape-compatible with the @repo/api device-connectivity transform input.
 */
export interface DeviceLifecycleEventRow {
  eventType: string | null;
  eventTimestamp: string | null;
  disconnectReason: string | null;
  sessionIdentifier: string | null;
}
