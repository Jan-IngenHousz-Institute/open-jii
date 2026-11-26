/**
 * The openJII INFO contract: `{"command":"INFO"}` answered by one bare
 * `{"status":"success","data":{device_name, device_type, device_id, firmware_version}}`
 * line. Ambit firmware 1.3.0 and later answers it without a restart, and the
 * MiniPAR and CO2Dot firmware add it, all with `device_id` set to the eFuse MAC.
 */
export const INFO_COMMAND = '{"command":"INFO"}';

/** First buffered line that parses to an object with a "status" key, if any. */
export function parseInfoReply(buffer: string): Record<string, unknown> | null {
  for (const line of buffer.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === "object" && "status" in parsed) {
        return parsed;
      }
    } catch {
      // not JSON, keep scanning
    }
  }
  return null;
}

/** The `data` object of a successful INFO reply, or null. */
export function parseInfoData(buffer: string): Record<string, unknown> | null {
  const parsed = parseInfoReply(buffer);
  if (parsed?.status !== "success") return null;
  return parsed.data !== null && typeof parsed.data === "object"
    ? (parsed.data as Record<string, unknown>)
    : null;
}

const MAC = /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/i;

/**
 * A six-byte MAC exactly as the firmware formats it (`AA:BB:CC:DD:EE:FF`,
 * byte zero first), uppercased. Anything else is not a hardware identity;
 * the platform applies its own normalization before using it as a key.
 */
export function reportedMac(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return MAC.test(trimmed) ? trimmed.toUpperCase() : undefined;
}
