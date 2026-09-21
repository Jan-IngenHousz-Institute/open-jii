/**
 * What a stored failure kind means to the person holding the phone. The row
 * stores the transport's own label; this narrows it to the few distinctions
 * that change what they should do next.
 */
export type UploadFailureCategory =
  | "connection"
  | "credentials"
  | "permission"
  | "rejected"
  | "unknown";

const CATEGORY_BY_KIND: Readonly<Record<string, UploadFailureCategory>> = {
  // MQTT transport.
  Timeout: "connection",
  Disconnected: "connection",
  PublishError: "connection",
  CredentialError: "credentials",
  // Large-upload transport.
  Network: "connection",
  Unauthenticated: "credentials",
  Forbidden: "permission",
  NotFound: "permission",
  NoExperiment: "rejected",
  Rejected: "rejected",
};

export function uploadFailureCategory(kind: string | null): UploadFailureCategory {
  if (kind === null || kind === "") return "unknown";

  return CATEGORY_BY_KIND[kind] ?? "unknown";
}

// Namespace-qualified: react-i18next pins `t` to the FIRST namespace of an
// array, so a bare `failureReason.x` from a multi-namespace screen renders raw.
export const UPLOAD_FAILURE_MESSAGE_KEYS = {
  connection: "recentMeasurements:failureReason.connection",
  credentials: "recentMeasurements:failureReason.credentials",
  permission: "recentMeasurements:failureReason.permission",
  rejected: "recentMeasurements:failureReason.rejected",
  unknown: "recentMeasurements:failureReason.unknown",
} as const satisfies Record<UploadFailureCategory, string>;

export function uploadFailureMessageKey(kind: string | null): string {
  return UPLOAD_FAILURE_MESSAGE_KEYS[uploadFailureCategory(kind)];
}
