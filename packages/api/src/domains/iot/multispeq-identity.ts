const FOUR_BYTES = /^[0-9a-f]{2}(:[0-9a-f]{2}){3}$/;
const PLACEHOLDERS = new Set(["00:00:00:00", "ff:ff:ff:ff"]);

/**
 * The canonical MultispeQ serial: the low four Bluetooth MAC bytes from `device_info.device_id`,
 * lowercase and colon-separated, the form the fleet producer and openJII Lab match on.
 * Returns null for anything else; a six-byte address is never truncated.
 */
export function canonicalMultispeqSerial(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const serial = raw.trim().toLowerCase();
  if (!FOUR_BYTES.test(serial) || PLACEHOLDERS.has(serial)) return null;
  return serial;
}
