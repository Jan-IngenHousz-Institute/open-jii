/**
 * Registration keys for the units a phone or bench connects (decisions 8 and 13 on the
 * Labs decisions page). The key is the family plus a normalized serial: the eFuse MAC for
 * an Ambit, a MiniPAR and a CO2Dot, in the byte order their INFO reply prints, and the
 * full Bluetooth address for a MultispeQ. Four bytes are never a key.
 */

/** Families a connection can register by the serial the unit itself reports. */
export const CONNECTED_FAMILIES = ["multispeq", "ambit", "minipar", "co2dot"] as const;
export type ConnectedFamily = (typeof CONNECTED_FAMILIES)[number];

const HEX_BYTE = /^[0-9a-f]{2}$/i;

function bytesOf(raw: string, count: number): string[] | null {
  const trimmed = raw.trim();
  const compact = trimmed.replace(/[:-]/g, "");
  if (compact.length !== count * 2) return null;
  // Separators, when present, sit between every byte.
  if (
    compact !== trimmed &&
    !new RegExp(`^[0-9a-f]{2}([:-][0-9a-f]{2}){${count - 1}}$`, "i").test(trimmed)
  ) {
    return null;
  }
  const bytes = compact.match(/.{2}/g) ?? [];
  if (bytes.length !== count || !bytes.every((byte) => HEX_BYTE.test(byte))) return null;
  const upper = bytes.map((byte) => byte.toUpperCase());
  if (upper.every((byte) => byte === "00") || upper.every((byte) => byte === "FF")) return null;
  return upper;
}

/**
 * A six-byte MAC or Bluetooth address as `AA:BB:CC:DD:EE:FF`, from colon, dash or bare hex
 * in any letter case. Returns null for anything else, including all-zero and all-FF
 * placeholders. Byte order is kept as given.
 */
export function normalizeMacSerial(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const bytes = bytesOf(raw, 6);
  return bytes ? bytes.join(":") : null;
}

/**
 * The four bytes a MultispeQ reports as `device_info.device_id`, as `AA:BB:CC:DD`. A person
 * typed them in, so they only confirm an address; they are never a key on their own.
 */
export function normalizeMultispeqReportedId(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const bytes = bytesOf(raw, 4);
  return bytes ? bytes.join(":") : null;
}

/**
 * Decision 13: an address fits a MultispeQ when the four bytes it reports equal the first
 * four or the last four bytes of the address. The firmware's comments disagree on which end
 * they are, so both ends count.
 */
export function multispeqAddressMatches(reportedId: string, address: string): boolean {
  const reported = normalizeMultispeqReportedId(reportedId);
  const full = normalizeMacSerial(address);
  if (reported === null || full === null) return false;
  const bytes = full.split(":");
  return bytes.slice(0, 4).join(":") === reported || bytes.slice(2).join(":") === reported;
}
