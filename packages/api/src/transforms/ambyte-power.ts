import type { DevicePowerReading } from "../domains/iot/device-power.schema";

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function count(value: unknown): number | null {
  const n = number(value);
  return n !== null && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Decode a telemetry entry without substituting its envelope's cached battery. */
export function extractAmbytePower(entry: unknown, capturedAt: string): DevicePowerReading | null {
  const telemetry = object(entry);
  if (telemetry.schema !== "ambyte.telemetry/1" || !Number.isFinite(Date.parse(capturedAt)))
    return null;
  const health = object(telemetry.health);
  const power = object(health.power);
  const protection = object(health.power_protect);
  const skipped = object(protection.skipped);
  return {
    capturedAt: new Date(capturedAt).toISOString(),
    valid: typeof power.valid === "boolean" ? power.valid : null,
    reason: string(power.reason),
    batteryV: number(power.battery_v),
    systemV: number(power.system_v),
    chargeStatus: count(power.charge_status),
    chargeMa: number(power.charge_ma),
    protection:
      Object.keys(protection).length === 0
        ? null
        : {
            state: string(protection.state),
            reason: string(protection.reason),
            sinceUtc: count(protection.since_utc),
            skipped: {
              flashRuns: count(skipped.flash_runs),
              ambitRuns: count(skipped.ambit_runs),
              ota: count(skipped.ota),
            },
          },
  };
}

export function hasUsableBattery(reading: DevicePowerReading): boolean {
  return reading.valid === true && reading.batteryV !== null && reading.batteryV > 0;
}
