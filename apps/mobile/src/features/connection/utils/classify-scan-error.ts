export type ScanErrorKind = "cancelled" | "disconnected" | "scanError";

// Messages thrown by the driver/transport when the link is dead. The polled
// "connected" flag lags a real drop, so a scan can fire at a dead device.
const DISCONNECTED_MARKERS = [
  "Failed to write to device",
  "device not open", // USB-serial write to a closed (unplugged) port
  "Command timeout",
  "Command executor not initialized",
  "Transport not initialized",
  "Command cancelled", // driver aborts in-flight on disconnect/teardown
];

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
