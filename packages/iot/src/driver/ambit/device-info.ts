/**
 * Parser for the Ambit boot dump: `reboot` prints the MAC, firmware build, stored
 * coefficients, LED curve and ADPD baseline as free-text lines, and nowhere else.
 *
 * Every field is optional because the dump is read on a timeout: a device that answered
 * slowly, or stopped mid-boot, yields the lines it managed to print and no others. A
 * coefficient nobody could read is therefore absent rather than zero, which matters most
 * to the write-back readback, where a fabricated 0 would verify against itself.
 */

export type AmbitMetadata = Record<string, number | string>;

export interface AmbitDeviceInfo {
  firmwareVersion?: string;
  mac?: string;
  firmwareSize?: number;
  firmwareDate?: string;
  name?: string;
  adpdChipVersion?: number;
  metadata?: AmbitMetadata;

  /** Stored coefficients: what a write-back is checked against once the device reboots. */
  lightSlope?: number;
  actLedCoeff?: number;
  emitCoeff?: number;
  sunCoeff?: number;
  tempOffset?: number;
  tempSlope?: number;

  actinicCurve?: Record<number, number>;
  adpdCalibration?: number[];
  mlxCalibration?: number[];
}

/**
 * How many lines the firmware's own dump runs to before the terminating `FW:` line.
 * Counted from the first line the parser recognises, not from the first byte read: a
 * reboot over a UART bridge starts with the chip's ROM and bootloader log, which is
 * longer than the dump and would exhaust a budget counted from the top.
 */
export const AMBIT_BOOT_DUMP_MAX_LINES = 26;

/**
 * Pairs are separated by whitespace or commas; the `FW: MAC:` line is tab-separated
 * because its Date contains spaces.
 */
function keyValuePairs(text: string, tabSeparated = false): Map<string, string> {
  const tokens = tabSeparated ? text.split("\t") : text.replace(/,/g, " ").split(/\s+/);
  const out = new Map<string, string>();
  for (const raw of tokens) {
    const token = raw.trim();
    const separator = token.indexOf(":");
    if (separator > 0) {
      out.set(token.slice(0, separator).trim(), token.slice(separator + 1).trim());
    }
  }
  return out;
}

/** A dotted value is a float, a bare one an integer, anything else stays text. */
function coerceNumber(value: string): number | string {
  const parsed = value.includes(".") ? Number.parseFloat(value) : Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? value : parsed;
}

function toFloat(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** The integers in a whitespace-separated run, skipping anything that is not one. */
function integerVector(text: string): number[] {
  return text
    .split(/\s+/)
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => !Number.isNaN(entry));
}

/** "Calibration: ADPD: 0\t0\t..." , the LED curve, or the main coefficient line. */
function parseCalibrationLine(payload: string): AmbitDeviceInfo {
  if (payload.startsWith("ADPD")) {
    const separator = payload.indexOf(":");
    return separator < 0 ? {} : { adpdCalibration: integerVector(payload.slice(separator + 1)) };
  }

  const pairs = keyValuePairs(payload);

  // "Act_50:983 Act_100:2032 ..." is the LED curve rather than the main line.
  const actinicCurve: Record<number, number> = {};
  for (const [key, value] of pairs) {
    if (!key.startsWith("Act_")) {
      continue;
    }
    const setting = toInt(key.slice("Act_".length));
    const count = toInt(value);
    if (setting !== undefined && count !== undefined) {
      actinicCurve[setting] = count;
    }
  }
  if (Object.keys(actinicCurve).length > 0) {
    return { actinicCurve };
  }

  const name = pairs.get("Name");
  const lightSlope = toFloat(pairs.get("Spec"));
  const actLedCoeff = toFloat(pairs.get("Actinic"));
  const emitCoeff = toFloat(pairs.get("Emit"));
  const sunCoeff = toFloat(pairs.get("Sun"));
  const tempOffset = toFloat(pairs.get("Temp_offset"));
  const tempSlope = toFloat(pairs.get("Temp_slope"));

  // Spread only what the line read, so a later line cannot erase an earlier value.
  return {
    ...(name !== undefined ? { name } : {}),
    ...(lightSlope !== undefined ? { lightSlope } : {}),
    ...(actLedCoeff !== undefined ? { actLedCoeff } : {}),
    ...(emitCoeff !== undefined ? { emitCoeff } : {}),
    ...(sunCoeff !== undefined ? { sunCoeff } : {}),
    ...(tempOffset !== undefined ? { tempOffset } : {}),
    ...(tempSlope !== undefined ? { tempSlope } : {}),
  };
}

/** What one boot-dump line carries. An unknown line carries nothing. */
export function parseAmbitBootLine(line: string): AmbitDeviceInfo {
  const text = line.trim();
  if (text.length === 0) {
    return {};
  }

  if (text.includes("ADPD Found") && text.includes("chip version:")) {
    const adpdChipVersion = toInt(text.split("chip version:")[1]?.trim());
    return adpdChipVersion !== undefined ? { adpdChipVersion } : {};
  }

  // Tab-separated like the FW line, and for the same reason: `info1` is free text an
  // operator types, so a whitespace split would end it at the first space.
  if (text.startsWith("Metadata:")) {
    const metadata: AmbitMetadata = {};
    for (const [key, value] of keyValuePairs(text.slice("Metadata:".length), true)) {
      metadata[key] = coerceNumber(value);
    }
    return { metadata };
  }

  if (text.startsWith("Calibration:")) {
    return parseCalibrationLine(text.slice("Calibration:".length).trim());
  }

  if (text.startsWith("MLX:")) {
    return { mlxCalibration: integerVector(text.slice("MLX:".length)) };
  }

  if (text.startsWith("FW:")) {
    const body = text.slice("FW:".length).trim();
    if (!body.includes("MAC:")) {
      return { firmwareVersion: body };
    }
    const pairs = keyValuePairs(body, true);
    const mac = pairs.get("MAC");
    const firmwareSize = toInt(pairs.get("Size"));
    const firmwareDate = pairs.get("Date");
    return {
      ...(mac !== undefined ? { mac } : {}),
      ...(firmwareSize !== undefined ? { firmwareSize } : {}),
      ...(firmwareDate !== undefined ? { firmwareDate } : {}),
    };
  }

  return {};
}

/**
 * What the line reported, over what earlier lines reported. A line only carries the keys
 * it could read, so nothing here erases an earlier value. The LED curve is the exception:
 * the firmware prints it over several lines, so its points accumulate.
 */
function withLine(info: AmbitDeviceInfo, fields: AmbitDeviceInfo): AmbitDeviceInfo {
  const merged: AmbitDeviceInfo = { ...info, ...fields };
  if (info.actinicCurve && fields.actinicCurve) {
    merged.actinicCurve = { ...info.actinicCurve, ...fields.actinicCurve };
  }
  return merged;
}

/**
 * The dump ends with the plain `FW:` version line; anything after it is the next console
 * exchange. Null when no line identified itself as part of a boot dump, which is what a
 * read that timed out before the device said anything looks like.
 */
export function parseAmbitBootDump(dump: string): AmbitDeviceInfo | null {
  let info: AmbitDeviceInfo = {};
  let recognized = false;
  let budget = AMBIT_BOOT_DUMP_MAX_LINES;

  for (const line of dump.split(/\r?\n/)) {
    const fields = parseAmbitBootLine(line);
    if (Object.keys(fields).length > 0) {
      info = withLine(info, fields);
      recognized = true;
    }

    // The bootloader's own lines cost nothing; the budget starts at the first one the
    // firmware wrote, and ends the read of a device that never prints its FW: line.
    if (recognized && --budget < 0) {
      break;
    }

    const text = line.trim();
    if (text.startsWith("FW:") && !text.includes("MAC")) {
      break;
    }
  }

  return recognized ? info : null;
}

/** The coefficients the device holds, leaving out the ones the dump never reported. */
export function ambitStoredCoefficients(info: AmbitDeviceInfo): Record<string, number> {
  const named: [string, number | undefined][] = [
    ["spec", info.lightSlope],
    ["act", info.actLedCoeff],
    ["emit", info.emitCoeff],
    ["sun", info.sunCoeff],
    ["temp_offset", info.tempOffset],
    ["temp_slope", info.tempSlope],
  ];

  const stored: Record<string, number> = {};
  for (const [key, value] of named) {
    if (value !== undefined) {
      stored[key] = value;
    }
  }
  return stored;
}
