// DEVICE columns come back as STRUCT<id, serial_number, owner, status, device_type>
// JSON strings. Charts group and colour by the serial number, so both the data hook
// and the colour-map picker flatten each cell through this one converter to stay aligned.

const UNKNOWN_DEVICE = "Unknown device";

export function deviceDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    return UNKNOWN_DEVICE;
  }
  try {
    const parsed = JSON.parse(value) as { serial_number?: unknown };
    const serial = typeof parsed.serial_number === "string" ? parsed.serial_number.trim() : "";
    return serial.length > 0 ? serial : UNKNOWN_DEVICE;
  } catch {
    return UNKNOWN_DEVICE;
  }
}
