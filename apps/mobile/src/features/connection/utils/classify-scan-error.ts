export type ScanErrorKind = "cancelled" | "disconnected" | "scanError";

// Messages thrown by the driver/transport/executor when the BLE link is dead.
// The cached "connected" flag is polled (~3s) and lags a real drop, so a scan
// can fire against a dead device and surface as one of these.
const DISCONNECTED_MARKERS = [
  "Failed to write to device",
  "Command timeout",
  "Command executor not initialized",
  "Transport not initialized",
  // The driver aborts the in-flight command with this when the transport reports
  // a disconnect (or is torn down); user-cancel is "Measurement cancelled".
  "Command cancelled",
];

// "Measurement cancelled" is user-initiated (handled by the cancel path), so it
// is not an error toast.
export function classifyScanError(error: unknown): ScanErrorKind {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Measurement cancelled")) {
    return "cancelled";
  }
  if (DISCONNECTED_MARKERS.some((marker) => message.includes(marker))) {
    return "disconnected";
  }
  return "scanError";
}
