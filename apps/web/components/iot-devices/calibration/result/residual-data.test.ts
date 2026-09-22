import { describe, expect, it } from "vitest";

import type { CalibrationBlock } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { residualReport } from "./residual-data";

function block(quality: Record<string, unknown>): CalibrationBlock {
  return { status: "computed", coefficients: { slope: 1 }, quality };
}

describe("residualReport", () => {
  // The scripts report the worst residual twice, in units and as a fraction, so the span
  // they were judged against is the ratio between them. Nothing else records it.
  it("reads each residual as a fraction of the range the gate used", () => {
    const report = residualReport(
      block({
        residuals: [0.5, -1, 2],
        worst_residual: 2,
        worst_residual_fraction: 0.02,
        chart: {
          x: "par_raw",
          y: "par_ref",
          points: [
            [10, 11],
            [20, 21],
            [30, 31],
          ],
        },
        thresholds: { max_full_scale_residual: 0.1 },
      }),
    );

    // Full scale is 2 / 0.02 = 100, so the residuals are 0.5%, -1% and 2% of it.
    expect(report?.points).toEqual([
      { x: 10, fraction: 0.005 },
      { x: 20, fraction: -0.01 },
      { x: 30, fraction: 0.02 },
    ]);
    expect(report?.tolerance).toBe(0.1);
    expect(report?.xLabel).toBe("par_raw");
  });

  it("falls back to the point's position when the script recorded no axis", () => {
    const report = residualReport(
      block({ residuals: [1], worst_residual: 1, worst_residual_fraction: 0.5 }),
    );

    expect(report?.points).toEqual([{ x: 1, fraction: 0.5 }]);
    expect(report?.xLabel).toBeNull();
  });

  it("says when the script capped how many residuals it reported", () => {
    const report = residualReport(
      block({
        residuals: [1],
        residuals_truncated: true,
        worst_residual: 1,
        worst_residual_fraction: 0.5,
      }),
    );

    expect(report?.truncated).toBe(true);
  });

  // Without the pair there is no range, and a residual in unknown units cannot be drawn
  // against a threshold expressed as a fraction.
  it("draws nothing when the range cannot be derived", () => {
    expect(residualReport(block({ residuals: [1, 2] }))).toBeNull();
    expect(
      residualReport(block({ residuals: [1], worst_residual: 1, worst_residual_fraction: 0 })),
    ).toBeNull();
  });

  it("draws nothing for a block that carries no quality record", () => {
    expect(residualReport({ status: "skipped" })).toBeNull();
  });
});
