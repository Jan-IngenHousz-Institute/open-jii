const UNKNOWN_DEVICE = "Unknown device";

// Rows carry DEVICE structs; the distinct-values endpoint projects their labels.
export function deviceDisplayName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return UNKNOWN_DEVICE;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed !== null && typeof parsed === "object") {
      const serial = "serial_number" in parsed ? parsed.serial_number : undefined;
      return typeof serial === "string" && serial.trim().length > 0
        ? serial.trim()
        : UNKNOWN_DEVICE;
    }
    return value.trim();
  } catch {
    return value.trim();
  }
}
