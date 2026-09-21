import { describe, expect, it } from "vitest";

import { MAX_PROCEDURE_STEPS } from "./iot-calibration-procedure.schema";
import {
  MAX_PAYLOAD_SERIES,
  MAX_SERIES_CELL_TEXT,
  zCalibrationBlocks,
  zCalibrationOutputSchema,
  zCalibrationRunPayload,
  zCreateCalibrationRunBody,
  zFirmwareVersion,
  zReportedFirmwareVersion,
  zReportDeviceCalibrationWriteBody,
  serialsMatch,
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

  // The bound follows the procedure's: every step may record a series and its retaken
  // companion, so a procedure the contract accepted must never be refused at submit.
  it("holds a series and a retaken companion for every step a procedure may declare", () => {
    const series: Record<string, { value: number }[]> = {};
    for (let index = 0; index < MAX_PROCEDURE_STEPS; index++) {
      series[`series_${index}`] = [{ value: index }];
      series[`series_${index}_retaken`] = [{ value: index }];
    }
    expect(Object.keys(series)).toHaveLength(MAX_PAYLOAD_SERIES);
    expect(zCalibrationRunPayload.safeParse(series).success).toBe(true);
  });

  it("rejects one series beyond that", () => {
    const series = Object.fromEntries(
      Array.from({ length: MAX_PAYLOAD_SERIES + 1 }, (_, i) => [`series_${i}`, [{ value: i }]]),
    );
    expect(zCalibrationRunPayload.safeParse(series).success).toBe(false);
  });

  // A structured device reply travels as text; a protocol envelope is tens of kilobytes.
  it("holds a structured reply as text up to the cell cap, and no further", () => {
    const cell = (length: number) => ({ reading: [{ reply: "x".repeat(length) }] });
    expect(zCalibrationRunPayload.safeParse(cell(MAX_SERIES_CELL_TEXT)).success).toBe(true);
    expect(zCalibrationRunPayload.safeParse(cell(MAX_SERIES_CELL_TEXT + 1)).success).toBe(false);
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

  // A block with nothing in it computes nothing, passes review, and applies an empty write.
  it("rejects a block that declares no coefficient", () => {
    expect(zCalibrationOutputSchema.safeParse({ blocks: { par: {} } }).success).toBe(false);
  });

  // Bounds the wrong way round would refuse every value a fit could produce.
  it("rejects a coefficient whose min exceeds its max", () => {
    const schema = (spec: Record<string, unknown>) => ({ blocks: { par: { slope: spec } } });
    expect(
      zCalibrationOutputSchema.safeParse(schema({ type: "number", min: 2, max: 1 })).success,
    ).toBe(false);
    expect(
      zCalibrationOutputSchema.safeParse(
        schema({ type: "integer_array", length: 6, min: 10, max: 0 }),
      ).success,
    ).toBe(false);
    expect(
      zCalibrationOutputSchema.safeParse(schema({ type: "number", min: 1, max: 1 })).success,
    ).toBe(true);
  });

  // A spectral sensor holds one coefficient per channel, fractional and signed.
  it("accepts a number array coefficient with per-entry bounds", () => {
    const result = zCalibrationOutputSchema.safeParse({
      blocks: {
        spec: { channel_coefficients: { type: "number_array", length: 10, min: -1, max: 1 } },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a number array without a length", () => {
    const result = zCalibrationOutputSchema.safeParse({
      blocks: { spec: { channel_coefficients: { type: "number_array" } } },
    });
    expect(result.success).toBe(false);
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

  it("accepts a block whose coefficient is an array of fractional numbers", () => {
    const result = zCalibrationBlocks.safeParse({
      spec: {
        status: "computed",
        coefficients: { channel_coefficients: [0.00785574, 0.00343847, -0.000739113] },
      },
    });
    expect(result.success).toBe(true);
  });

  // NaN and infinity cannot cross JSON; a block carrying one is a script fault, not data.
  it("rejects a non-finite coefficient", () => {
    const result = zCalibrationBlocks.safeParse({
      par: { status: "computed", coefficients: { spec: Number.POSITIVE_INFINITY } },
    });
    expect(result.success).toBe(false);
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

  // A script, or a bench posting its own blocks, could otherwise put megabytes
  // into a row that every run listing reads.
  it("rejects a fit record past the byte cap", () => {
    const result = zCalibrationBlocks.safeParse({
      par: {
        status: "computed",
        coefficients: { spec: 1.1893 },
        fit: { points: Array.from({ length: 10_000 }, () => 1.234567) },
      },
    });
    expect(result.success).toBe(false);
  });

  it("keeps a fit record a real bench session produces", () => {
    const result = zCalibrationBlocks.safeParse({
      par: {
        status: "computed",
        coefficients: { spec: 1.1893 },
        fit: {
          r_squared: 0.9987,
          points: [
            [402.12, 420],
            [142.92, 150],
          ],
        },
        quality: { passed: true, reasons: [] },
      },
    });
    expect(result.success).toBe(true);
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

  // The definition column is varchar(32); a version the contract accepted must store.
  it("rejects a version longer than the column that stores it", () => {
    expect(zFirmwareVersion.safeParse(`1.${"2".repeat(40)}`).success).toBe(false);
  });
});

describe("zReportedFirmwareVersion", () => {
  // A floor is declared clean; what a device answers is not, and the run is recorded
  // against the version it gave rather than against nothing.
  it("accepts the release suffix a device appends", () => {
    expect(zReportedFirmwareVersion.safeParse("1.1.3-rc2").success).toBe(true);
    expect(zReportedFirmwareVersion.safeParse("1.03+build7").success).toBe(true);
    expect(zReportedFirmwareVersion.safeParse("1.1.3").success).toBe(true);
  });

  it("still refuses what is not a version at all", () => {
    expect(zReportedFirmwareVersion.safeParse("v1.2.3").success).toBe(false);
    expect(zReportedFirmwareVersion.safeParse("1").success).toBe(false);
    expect(zReportedFirmwareVersion.safeParse("1.2.3-").success).toBe(false);
    expect(zReportedFirmwareVersion.safeParse("").success).toBe(false);
  });

  // A suffix cannot buy a version more room than a declared floor gets.
  it("rejects a version longer than the contract allows", () => {
    expect(zReportedFirmwareVersion.safeParse(`1.2.3-${"a".repeat(40)}`).success).toBe(false);
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

  it("carries the identifier the unit announced, when its firmware names one", () => {
    const result = zCreateCalibrationRunBody.safeParse({
      ...body({}),
      reportedSerial: " a4cf12aa93b0 ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reportedSerial).toBe("a4cf12aa93b0");
    }
  });

  // A missing series is mute; the step the bench could not run says why it is missing.
  it("carries the optional steps the bench skipped, with their reasons", () => {
    const result = zCreateCalibrationRunBody.safeParse({
      ...body({}),
      skippedSeries: [{ series: "led_sweep", reason: 'instrument "emit_ref" is not connected' }],
    });
    expect(result.success).toBe(true);
  });
});

describe("serialsMatch", () => {
  // An Ambit prints its MAC as twelve hex digits; a registrar may have typed it with colons.
  it("matches a serial however its separators and case were written", () => {
    expect(serialsMatch("a4cf12aa93b0", "A4:CF:12:AA:93:B0")).toBe(true);
    expect(serialsMatch("MSQ-0042", "msq0042")).toBe(true);
  });

  it("refuses a different unit, and an identifier that says nothing", () => {
    expect(serialsMatch("a4cf12aa93b0", "a4cf12aa93b1")).toBe(false);
    expect(serialsMatch("--", "a4cf12aa93b0")).toBe(false);
  });
});

describe("zReportDeviceCalibrationWriteBody", () => {
  const calibrationId = "33333333-3333-4333-8333-333333333333";

  it("records what each block's write came to", () => {
    const result = zReportDeviceCalibrationWriteBody.safeParse({
      calibrationId,
      writeResults: { par: { verified: true } },
      reportedSerial: "a4cf12aa93b0",
    });
    expect(result.success).toBe(true);
  });

  // An empty report would still stamp the calibration as written to the device.
  it("refuses a report that confirms no block at all", () => {
    const result = zReportDeviceCalibrationWriteBody.safeParse({
      calibrationId,
      writeResults: {},
    });
    expect(result.success).toBe(false);
  });
});
