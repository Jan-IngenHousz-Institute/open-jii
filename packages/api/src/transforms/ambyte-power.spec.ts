import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { zDevicePower } from "../domains/iot/device-power.schema";
import { zDeviceBatteryPoint, zDeviceMonitoring } from "../domains/iot/iot.schema";
import { extractAmbytePower, hasUsableBattery } from "./ambyte-power";
import { normalizeMacroInput } from "./normalize-macro-input";

const directory = resolve(__dirname, "../../../../apps/data/reference-macros/ambyte-power-v1");
const macro = readFileSync(resolve(directory, "macro.js"), "utf8");
const fixtures = z
  .array(
    z.object({
      name: z.string(),
      capturedAt: z.string(),
      entry: z.record(z.string(), z.unknown()),
    }),
  )
  .parse(JSON.parse(readFileSync(resolve(directory, "fixtures.json"), "utf8")));
const schema = z
  .object({
    fields: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean() })),
  })
  .parse(JSON.parse(readFileSync(resolve(directory, "schema.json"), "utf8")));

describe("Ambyte power extraction and reference macro", () => {
  it.each(fixtures)(
    "serializes $name through the macro host projection and API",
    ({ entry, capturedAt }) => {
      const sample: unknown = JSON.parse(JSON.stringify([entry]));
      const normalized = normalizeMacroInput({ sample });
      expect(normalized.ok).toBe(true);
      if (!normalized.ok) throw new Error("fixture normalization failed");
      const result: unknown = runInNewContext(
        `(function(json) { ${macro}; return projectAmbytePower(json); })(json)`,
        {
          json: normalized.value,
        },
      );
      const output = z.record(z.string(), z.unknown()).parse(JSON.parse(JSON.stringify(result)));
      const reading = extractAmbytePower(normalized.value, capturedAt);
      expect(reading).not.toBeNull();
      if (!reading) throw new Error("missing telemetry");
      expect(output).toEqual({
        power_valid: reading.valid,
        power_reason: reading.reason,
        power_battery_v: reading.batteryV,
        power_system_v: reading.systemV,
        power_charge_status: reading.chargeStatus,
        power_charge_ma: reading.chargeMa,
        power_protect_state: reading.protection?.state ?? null,
        power_protect_reason: reading.protection?.reason ?? null,
        power_protect_since_utc: reading.protection?.sinceUtc ?? null,
        power_protect_skipped_flash_runs: reading.protection?.skipped.flashRuns ?? null,
        power_protect_skipped_ambit_runs: reading.protection?.skipped.ambitRuns ?? null,
        power_protect_skipped_ota: reading.protection?.skipped.ota ?? null,
      });
      expect(Object.keys(output).sort()).toEqual(schema.fields.map((field) => field.name).sort());
      for (const field of schema.fields) {
        expect(field.nullable).toBe(true);
        if (output[field.name] !== null)
          expect(typeof output[field.name]).toBe(
            field.type === "long" || field.type === "double" ? "number" : field.type,
          );
      }
      const power = {
        latest: reading,
        lastValidBattery: hasUsableBattery(reading)
          ? { capturedAt, batteryV: reading.batteryV }
          : null,
      };
      expect(zDevicePower.parse(JSON.parse(JSON.stringify(power)))).toEqual(power);
      expect(zDeviceMonitoring.shape.power.parse(power)).toEqual(power);
    },
  );

  it("does not treat a healthy system rail or envelope as usable VBAT", () => {
    const reading = extractAmbytePower(
      {
        schema: "ambyte.telemetry/1",
        device_battery: 4.1,
        health: { power: { valid: true, battery_v: 0, system_v: 4.1 } },
      },
      "2026-01-01T00:00:00Z",
    );
    expect(reading?.batteryV).toBe(0);
    expect(reading && hasUsableBattery(reading)).toBe(false);
  });

  it("preserves protection when the power object is absent or malformed", () => {
    const reading = extractAmbytePower(
      {
        schema: "ambyte.telemetry/1",
        health: {
          power: { battery_v: Infinity, valid: "true" },
          power_protect: { state: "hold", skipped: { flash_runs: -1 } },
        },
      },
      "2026-01-01T00:00:00Z",
    );
    expect(reading).toMatchObject({
      valid: null,
      batteryV: null,
      protection: { state: "hold", skipped: { flashRuns: null } },
    });
  });

  it("retains legacy contracts and rejects unrecognized telemetry", () => {
    expect(zDeviceMonitoring.shape.power.parse(undefined)).toBeUndefined();
    expect(
      zDeviceBatteryPoint.parse({ bucketStart: "2026-01-01T00:00:00Z", averageBattery: 85 }),
    ).toEqual({ bucketStart: "2026-01-01T00:00:00Z", averageBattery: 85 });
    expect(extractAmbytePower({ device_battery: 85 }, "2026-01-01T00:00:00Z")).toBeNull();
    expect(extractAmbytePower({ schema: "ambyte.telemetry/1" }, "bad timestamp")).toBeNull();
  });
});
