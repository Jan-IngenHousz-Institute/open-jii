import { describe, expect, it } from "vitest";

import type { CalibrationOutputSchema } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import {
  appliedCalibrationBlocks,
  hasComputedBlock,
  validateCalibrationBlocks,
} from "./calibration-blocks";

const AMBIT_SCHEMA: CalibrationOutputSchema = {
  blocks: {
    par: { spec: { type: "number", min: 0.05, max: 100.0 } },
    baseline: { channels: { type: "integer_array", length: 6, min: 0, max: 16_777_215 } },
  },
};

describe("validateCalibrationBlocks", () => {
  it("accepts blocks matching the schema", () => {
    const reasons = validateCalibrationBlocks(
      {
        par: { status: "computed", coefficients: { spec: 1.19 }, quality: { passed: true } },
        baseline: {
          status: "computed",
          coefficients: { channels: [1021, 987, 1103, 954, 1200, 1015] },
        },
      },
      AMBIT_SCHEMA,
    );
    expect(reasons).toEqual([]);
  });

  it("flags missing and undeclared blocks", () => {
    const reasons = validateCalibrationBlocks(
      { extra: { status: "computed", coefficients: { x: 1 } } },
      AMBIT_SCHEMA,
    );
    expect(reasons.some((r) => r.includes("'par' is required"))).toBe(true);
    expect(reasons.some((r) => r.includes("'baseline' is required"))).toBe(true);
    expect(reasons.some((r) => r.includes("'extra' is not declared"))).toBe(true);
  });

  it("flags out-of-bounds and undeclared coefficients", () => {
    const reasons = validateCalibrationBlocks(
      {
        par: { status: "computed", coefficients: { spec: 250.0, stray: 1 } },
        baseline: { status: "computed", coefficients: { channels: [1, 2, 3, 4, 5, 6] } },
      },
      AMBIT_SCHEMA,
    );
    expect(reasons.some((r) => r.includes("above the allowed maximum"))).toBe(true);
    expect(reasons.some((r) => r.includes("'par.stray' is not declared"))).toBe(true);
  });

  it("flags non-finite numbers and wrong-length arrays", () => {
    const reasons = validateCalibrationBlocks(
      {
        par: { status: "computed", coefficients: { spec: Number.NaN } },
        baseline: { status: "computed", coefficients: { channels: [1, 2, 3] } },
      },
      AMBIT_SCHEMA,
    );
    expect(reasons.some((r) => r.includes("finite number"))).toBe(true);
    expect(reasons.some((r) => r.includes("exactly 6 entries"))).toBe(true);
  });

  it("flags a declared coefficient the block left out", () => {
    const reasons = validateCalibrationBlocks(
      {
        par: { status: "computed", coefficients: {} },
        baseline: { status: "computed", coefficients: { channels: [1, 2, 3, 4, 5, 6] } },
      },
      AMBIT_SCHEMA,
    );
    expect(reasons).toEqual(["Coefficient 'par.spec' is required but missing"]);
  });

  it("flags a number below the allowed minimum", () => {
    const reasons = validateCalibrationBlocks(
      {
        par: { status: "computed", coefficients: { spec: 0.001 } },
        baseline: { status: "computed", coefficients: { channels: [1, 2, 3, 4, 5, 6] } },
      },
      AMBIT_SCHEMA,
    );
    expect(reasons).toEqual(["Coefficient 'par.spec' is below the allowed minimum 0.05"]);
  });

  it("flags an integer array given as a scalar", () => {
    const reasons = validateCalibrationBlocks(
      {
        par: { status: "computed", coefficients: { spec: 1.19 } },
        baseline: { status: "computed", coefficients: { channels: 1021 } },
      },
      AMBIT_SCHEMA,
    );
    expect(reasons).toEqual(["Coefficient 'baseline.channels' must be an integer array"]);
  });

  it("flags each array entry that is fractional or out of bounds", () => {
    const reasons = validateCalibrationBlocks(
      {
        par: { status: "computed", coefficients: { spec: 1.19 } },
        baseline: {
          status: "computed",
          coefficients: { channels: [1.5, -1, 16_777_216, 4, 5, 6] },
        },
      },
      AMBIT_SCHEMA,
    );
    expect(reasons).toEqual([
      "Coefficient 'baseline.channels[0]' must be an integer",
      "Coefficient 'baseline.channels[1]' is below the allowed minimum",
      "Coefficient 'baseline.channels[2]' is above the allowed maximum",
    ]);
  });

  describe("number arrays", () => {
    const SPECTRAL_SCHEMA: CalibrationOutputSchema = {
      blocks: {
        spec: { channel_coefficients: { type: "number_array", length: 3, min: -1, max: 1 } },
      },
    };

    it("accepts fractional and signed entries within bounds", () => {
      const reasons = validateCalibrationBlocks(
        {
          spec: {
            status: "computed",
            coefficients: { channel_coefficients: [0.00785574, -0.000739113, 0] },
          },
        },
        SPECTRAL_SCHEMA,
      );
      expect(reasons).toEqual([]);
    });

    it("flags a number array given as a scalar", () => {
      const reasons = validateCalibrationBlocks(
        { spec: { status: "computed", coefficients: { channel_coefficients: 0.5 } } },
        SPECTRAL_SCHEMA,
      );
      expect(reasons).toEqual(["Coefficient 'spec.channel_coefficients' must be a number array"]);
    });

    it("flags a wrong length and each entry out of bounds or not finite", () => {
      expect(
        validateCalibrationBlocks(
          { spec: { status: "computed", coefficients: { channel_coefficients: [0.1, 0.2] } } },
          SPECTRAL_SCHEMA,
        ),
      ).toEqual(["Coefficient 'spec.channel_coefficients' must have exactly 3 entries"]);

      expect(
        validateCalibrationBlocks(
          {
            spec: {
              status: "computed",
              coefficients: { channel_coefficients: [Number.NaN, -2, 1.5] },
            },
          },
          SPECTRAL_SCHEMA,
        ),
      ).toEqual([
        "Coefficient 'spec.channel_coefficients[0]' must be a finite number",
        "Coefficient 'spec.channel_coefficients[1]' is below the allowed minimum",
        "Coefficient 'spec.channel_coefficients[2]' is above the allowed maximum",
      ]);
    });
  });

  // The thresholds behind a quality record are the platform's, not the scientist's,
  // so a failed record travels with the block and the reviewer decides.
  it("treats a failed QC record as advisory, not a violation", () => {
    const reasons = validateCalibrationBlocks(
      {
        par: {
          status: "computed",
          coefficients: { spec: 1.19 },
          quality: { passed: false, reasons: ["R-squared must be at least 0.99"] },
        },
        baseline: { status: "computed", coefficients: { channels: [1, 2, 3, 4, 5, 6] } },
      },
      AMBIT_SCHEMA,
    );
    expect(reasons).toEqual([]);
  });

  // The bench session the all-or-nothing model rejected outright: one gain
  // fitted, one attempted and failed QC, one never attempted.
  describe("partial bench sessions", () => {
    const partial = {
      par: { status: "computed" as const, coefficients: { spec: 1.19 }, quality: { passed: true } },
      baseline: { status: "skipped" as const, reason: "dark fixture not confirmed" },
    };

    it("accepts a session where a declared block was skipped", () => {
      expect(validateCalibrationBlocks(partial, AMBIT_SCHEMA)).toEqual([]);
    });

    it("does not check coefficients on rejected or skipped blocks", () => {
      const reasons = validateCalibrationBlocks(
        {
          par: {
            status: "rejected",
            quality: { passed: false, reasons: ["R-squared must be at least 0.99"] },
          },
          baseline: { status: "skipped", reason: "no dark fixture" },
        },
        AMBIT_SCHEMA,
      );
      expect(reasons).toEqual([]);
    });

    it("applies only the computed blocks, stripped of their status", () => {
      expect(appliedCalibrationBlocks(partial)).toEqual({
        par: { coefficients: { spec: 1.19 }, quality: { passed: true } },
      });
    });

    // The fit record (points, residuals) is what the review chart draws, so an
    // applied block carries it along with the coefficients.
    it("keeps a computed block's fit record on the applied block", () => {
      const applied = appliedCalibrationBlocks({
        par: {
          status: "computed",
          coefficients: { spec: 1.19 },
          fit: { r_squared: 0.998, points: [[402.1, 420]] },
        },
      });
      expect(applied.par.fit).toEqual({ r_squared: 0.998, points: [[402.1, 420]] });
    });

    it("knows when a session produced nothing to apply", () => {
      expect(hasComputedBlock(partial)).toBe(true);
      expect(
        hasComputedBlock({
          par: { status: "rejected", reason: "fit failed" },
          baseline: { status: "skipped", reason: "no fixture" },
        }),
      ).toBe(false);
    });
  });
});
