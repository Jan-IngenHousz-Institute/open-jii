import { describe, expect, it } from "vitest";

import { fitLineFromCoefficients, fitPointsFromPayload } from "./fit-points";

describe("fitPointsFromPayload", () => {
  it("reads the device column as x and the reference column as y", () => {
    const points = fitPointsFromPayload({
      par_sweep: [
        { stimulus: "bright", par_raw: 420, par_ref: 402.12 },
        { stimulus: "dim", par_raw: 8.33, par_ref: 6.92 },
      ],
    });

    expect(points).toEqual([
      { x: 420, y: 402.12 },
      { x: 8.33, y: 6.92 },
    ]);
  });

  it("ignores the stimulus column even when it is numeric", () => {
    const points = fitPointsFromPayload({
      par_sweep: [{ stimulus: 0.8, par_raw: 148.2, par_ref: 176.4 }],
    });

    expect(points).toEqual([{ x: 148.2, y: 176.4 }]);
  });

  it("has nothing to plot for a series with one numeric column", () => {
    expect(fitPointsFromPayload({ vwc_curve: [{ stimulus: "sand", vwc_raw: 0.03 }] })).toEqual([]);
  });

  it("has nothing to plot for an empty payload", () => {
    expect(fitPointsFromPayload({})).toEqual([]);
  });
});

describe("fitLineFromCoefficients", () => {
  it("reads a free fit", () => {
    expect(fitLineFromCoefficients({ slope: 0.96, intercept: -1.08 })).toEqual({
      slope: 0.96,
      intercept: -1.08,
    });
  });

  it("reads a through-origin gain as a line through zero", () => {
    expect(fitLineFromCoefficients({ spec: 1.19 })).toEqual({ slope: 1.19, intercept: 0 });
  });

  it("is not a line for a vector block", () => {
    expect(fitLineFromCoefficients({ baseline: [1, 2, 3] })).toBeNull();
  });
});
