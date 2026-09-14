/**
 * Parser for the Ambit boot dump: `reboot` prints the MAC, firmware build, stored
 * coefficients, LED curve and ADPD baseline as free-text lines, and nowhere else.
 */

export type AmbitMetadata = Record<string, number | string>;

export interface AmbitDeviceInfo {
  firmwareVersion: string;
  mac: string;
  firmwareSize: number;
  firmwareDate: string;
  name: string;
  adpdChipVersion: number | null;
  metadata: AmbitMetadata;

  /** Stored coefficients. These are the values a write-back must restore on failure. */
  lightSlope: number;
  actLedCoeff: number;
  emitCoeff: number;
  sunCoeff: number;
  tempOffset: number;
  tempSlope: number;

  actinicCurve: Record<number, number>;
  adpdCalibration: number[];
  mlxCalibration: number[];

  /**
   * True when the dump reached the calibration or version line: the device answered
   * rather than the read timing out mid-boot.
   */
  isValid: boolean;
}

/** How many lines the firmware prints before the terminating `FW:` line. */
export const AMBIT_BOOT_DUMP_MAX_LINES = 26;

function emptyInfo(): AmbitDeviceInfo {
  return {
    firmwareVersion: "",
    mac: "",
    firmwareSize: 0,
    firmwareDate: "",
    name: "",
    adpdChipVersion: null,
    metadata: {},
    lightSlope: 0,
    actLedCoeff: 0,
    emitCoeff: 0,
    sunCoeff: 0,
    tempOffset: 0,
    tempSlope: 0,
    actinicCurve: {},
    adpdCalibration: [],
    mlxCalibration: [],
    isValid: false,
  };
}

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

function toFloat(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function applyCalibrationLine(info: AmbitDeviceInfo, payload: string): void {
  // "Calibration: ADPD: 0\t0\t0\t0\t0\t0"
  if (payload.startsWith("ADPD")) {
    const separator = payload.indexOf(":");
    if (separator >= 0) {
      info.adpdCalibration = payload
        .slice(separator + 1)
        .split(/\s+/)
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => !Number.isNaN(entry));
    }
    return;
  }

  const pairs = keyValuePairs(payload);

  // "Act_50:983 Act_100:2032 ..." is the LED curve rather than the main line.
  const curve: Record<number, number> = {};
  let hasCurvePoint = false;
  for (const [key, value] of pairs) {
    if (!key.startsWith("Act_")) continue;
    const setting = Number.parseInt(key.slice("Act_".length), 10);
    const count = Number.parseInt(value, 10);
    if (!Number.isNaN(setting) && !Number.isNaN(count)) {
      curve[setting] = count;
      hasCurvePoint = true;
    }
  }
  if (hasCurvePoint) {
    info.actinicCurve = { ...info.actinicCurve, ...curve };
    return;
  }

  const name = pairs.get("Name");
  if (name !== undefined) info.name = name;
  info.actLedCoeff = toFloat(pairs.get("Actinic"), info.actLedCoeff);
  info.emitCoeff = toFloat(pairs.get("Emit"), info.emitCoeff);
  info.sunCoeff = toFloat(pairs.get("Sun"), info.sunCoeff);
  info.tempOffset = toFloat(pairs.get("Temp_offset"), info.tempOffset);
  info.tempSlope = toFloat(pairs.get("Temp_slope"), info.tempSlope);

  // "Spec" present proves the dump reached the calibration line rather than timing out.
  const spec = pairs.get("Spec");
  if (spec !== undefined) {
    info.lightSlope = toFloat(spec, info.lightSlope);
    info.isValid = true;
  }
}

/** Fold one boot-dump line into the accumulating info. Unknown lines are ignored. */
export function applyAmbitBootLine(info: AmbitDeviceInfo, line: string): AmbitDeviceInfo {
  const text = line.trim();
  if (text.length === 0) return info;

  if (text.includes("ADPD Found") && text.includes("chip version:")) {
    const version = Number.parseInt(text.split("chip version:")[1]?.trim() ?? "", 10);
    if (!Number.isNaN(version)) info.adpdChipVersion = version;
    return info;
  }

  if (text.startsWith("Metadata:")) {
    const metadata: AmbitMetadata = {};
    for (const [key, value] of keyValuePairs(text.slice("Metadata:".length))) {
      metadata[key] = coerceNumber(value);
    }
    info.metadata = metadata;
    return info;
  }

  if (text.startsWith("Calibration:")) {
    applyCalibrationLine(info, text.slice("Calibration:".length).trim());
    return info;
  }

  if (text.startsWith("MLX:")) {
    info.mlxCalibration = text
      .slice("MLX:".length)
      .split(/\s+/)
      .map((entry) => Number.parseInt(entry.trim(), 10))
      .filter((entry) => !Number.isNaN(entry));
    return info;
  }

  if (text.startsWith("FW:")) {
    const body = text.slice("FW:".length).trim();
    if (body.includes("MAC:")) {
      const pairs = keyValuePairs(body, true);
      info.mac = pairs.get("MAC") ?? "";
      const size = Number.parseInt(pairs.get("Size") ?? "", 10);
      info.firmwareSize = Number.isNaN(size) ? 0 : size;
      info.firmwareDate = pairs.get("Date") ?? "";
    } else {
      info.firmwareVersion = body;
      info.isValid = true;
    }
  }

  return info;
}

/** The dump ends with the plain `FW:` version line; anything after it is the next console exchange. */
export function parseAmbitBootDump(dump: string): AmbitDeviceInfo {
  const info = emptyInfo();
  const lines = dump.split(/\r?\n/).slice(0, AMBIT_BOOT_DUMP_MAX_LINES);

  for (const line of lines) {
    applyAmbitBootLine(info, line);
    const text = line.trim();
    if (text.startsWith("FW:") && !text.includes("MAC")) break;
  }

  return info;
}

/** The coefficients a calibration write-back restores when a readback fails. */
export function ambitStoredCoefficients(info: AmbitDeviceInfo): Record<string, number> {
  return {
    spec: info.lightSlope,
    act: info.actLedCoeff,
    emit: info.emitCoeff,
    sun: info.sunCoeff,
    temp_offset: info.tempOffset,
    temp_slope: info.tempSlope,
  };
}
