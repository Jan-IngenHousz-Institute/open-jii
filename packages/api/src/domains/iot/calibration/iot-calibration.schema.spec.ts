import { describe, expect, it } from "vitest";

import {
  zCalibrationBlocks,
  zCalibrationOutputSchema,
  zCalibrationRunPayload,
  zCreateCalibrationRunBody,
  zFirmwareVersion,
} from "./iot-calibration.schema";

describe("zCalibrationRunPayload", () => {
  it("accepts the Ambit bench payload shape", () => {
    const result = zCalibrationRunPayload.safeParse({
      par_sweep: [
        { stimulus: 0.8, par_raw: 148.2, par_ref: 176.4 },
        { stimulus: 0.0, par_raw: 1.1, par_ref: 1.3 },
      ],
      adpd_baseline: [{ channels: [1021, 987, 1103, 954, 1200, 1015] }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts compound sweep setpoints in the stimulus column", () => {
    const result = zCalibrationRunPayload.safeParse({
      vwc_curve: [
        { stimulus: { medium: "sand", condition: "air_dry" }, vwc_raw: 0.03 },
        { stimulus: { medium: "sand", condition: "saturated" }, vwc_raw: 0.41 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 20 series", () => {
    const series = Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [`series_${i}`, [{ value: i }]]),
    );
    expect(zCalibrationRunPayload.safeParse(series).success).toBe(false);
  });

  it("rejects nested-object cells outside the compound-setpoint shape", () => {
    const result = zCalibrationRunPayload.safeParse({
      par_sweep: [{ stimulus: { nested: { too: "deep" } } }],
    });
    expect(result.success).toBe(false);
  });
});

describe("zCalibrationOutputSchema", () => {
  it("accepts the Ambit output schema", () => {
    const result = zCalibrationOutputSchema.safeParse({
      blocks: {
        par: { spec: { type: "number", min: 0.05, max: 100.0 } },
        led: { act: { type: "number", min: 0.01, max: 1.0 } },
        baseline: { channels: { type: "integer_array", length: 6, min: 0, max: 16_777_215 } },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty blocks object", () => {
    expect(zCalibrationOutputSchema.safeParse({ blocks: {} }).success).toBe(false);
  });
});

describe("zCalibrationBlocks", () => {
  it("accepts a pass-through block with no fit", () => {
    const result = zCalibrationBlocks.safeParse({
      baseline: {
        status: "computed",
        coefficients: { channels: [1021, 987, 1103, 954, 1200, 1015] },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fitted block with quality record", () => {
    const result = zCalibrationBlocks.safeParse({
      par: {
        status: "computed",
        coefficients: { spec: 1.1893 },
        fit: { x: [148.2], y: [176.4] },
        quality: { passed: true, r2: 0.9994 },
      },
    });
    expect(result.success).toBe(true);
  });

  // The bench session the all-or-nothing model could not express: one gain
  // fitted, one attempted and failed QC, one never attempted.
  it("accepts a partial session of computed, rejected, and skipped blocks", () => {
    const result = zCalibrationBlocks.safeParse({
      par: { status: "computed", coefficients: { spec: 1.1893 }, quality: { passed: true } },
      led: {
        status: "rejected",
        quality: { passed: false, reasons: ["R-squared must be at least 0.99"] },
        reason: "fit failed its quality gates",
      },
      baseline: { status: "skipped", reason: "dark fixture not confirmed" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a computed block with no coefficients", () => {
    const result = zCalibrationBlocks.safeParse({
      par: { status: "computed", quality: { passed: true } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a skipped block that still carries coefficients", () => {
    const result = zCalibrationBlocks.safeParse({
      par: { status: "skipped", coefficients: { spec: 1.1893 }, reason: "no reference" },
    });
    expect(result.success).toBe(false);
  });
});

describe("zFirmwareVersion", () => {
  // Families disagree on shape: Ambit reports three parts, MiniPAR two.
  it("accepts the versions devices actually report", () => {
    expect(zFirmwareVersion.safeParse("1.1.3").success).toBe(true);
    expect(zFirmwareVersion.safeParse("1.03").success).toBe(true);
    expect(zFirmwareVersion.safeParse("12.0.7").success).toBe(true);
  });

  it("rejects a bare number, a fourth part, and a prefix", () => {
    expect(zFirmwareVersion.safeParse("1").success).toBe(false);
    expect(zFirmwareVersion.safeParse("1.2.3.4").success).toBe(false);
    expect(zFirmwareVersion.safeParse("v1.2.3").success).toBe(false);
    expect(zFirmwareVersion.safeParse("1.1.3-rc1").success).toBe(false);
  });
});

describe("zCreateCalibrationRunBody", () => {
  const body = (preInfo: Record<string, unknown>) => ({
    deviceId: "11111111-1111-4111-8111-111111111111",
    definitionId: "22222222-2222-4222-8222-222222222222",
    payload: { par_sweep: [{ stimulus: "bright", par_raw: 420, par_ref: 402.12 }] },
    preInfo,
  });

  it("keeps a device's identity reply whole", () => {
    const result = zCreateCalibrationRunBody.safeParse(
      body({ helloReply: "MiniPAR,1.1,1.03", sensor_id: "AA:BB:CC:DD:EE:FF" }),
    );
    expect(result.success).toBe(true);
  });

  // The record is read on every run listing; it is a note, not a dump store.
  it("refuses device info beyond the size cap", () => {
    const result = zCreateCalibrationRunBody.safeParse(body({ dump: "x".repeat(20_000) }));
    expect(result.success).toBe(false);
  });
});
