/**
 * Canonical device identity for both workbook membership and uploaded rows.
 * Firmware identity wins when the result carries one; the caller supplies the
 * best known handshake/transport fallback for results that do not.
 */
export function resolveMeasurementDeviceId(
  rawMeasurement: unknown,
  fallbackDeviceId?: string,
): string | undefined {
  if (rawMeasurement !== null && typeof rawMeasurement === "object") {
    const firmwareDeviceId = (rawMeasurement as { device_id?: unknown }).device_id;
    switch (typeof firmwareDeviceId) {
      case "string":
        return firmwareDeviceId;
      case "number":
      case "bigint":
      case "boolean":
        return String(firmwareDeviceId);
    }
  }
  return fallbackDeviceId;
}
