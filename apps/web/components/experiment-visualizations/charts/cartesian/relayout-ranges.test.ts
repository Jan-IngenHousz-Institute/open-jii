import { describe, expect, it } from "vitest";

import { rangesAfterRelayout } from "./relayout-ranges";

describe("rangesAfterRelayout", () => {
  it("records a zoom on a numeric axis", () => {
    const ranges = rangesAfterRelayout({}, { "xaxis.range[0]": 10, "xaxis.range[1]": 20 });

    expect(ranges).toEqual({ x: [10, 20] });
  });

  it("reads Plotly's zone-less date strings as UTC, like the ISO timestamps the chart was given", () => {
    const ranges = rangesAfterRelayout(
      {},
      { "xaxis.range[0]": "2026-09-25 10:00:00", "xaxis.range[1]": "2026-09-25 12:30:00.5" },
    );

    expect(ranges.x).toEqual([
      Date.parse("2026-09-25T10:00:00Z"),
      Date.parse("2026-09-25T12:30:00.5Z"),
    ]);
  });

  it("accepts the range as one array, per facet axis", () => {
    const ranges = rangesAfterRelayout({ x: [0, 1] }, { "xaxis3.range": [5, 6] });

    expect(ranges).toEqual({ x: [0, 1], x3: [5, 6] });
  });

  it("drops an axis's range when it is reset to show everything", () => {
    const ranges = rangesAfterRelayout(
      { x: [0, 1], x2: [2, 3] },
      { "xaxis.autorange": true, "yaxis.autorange": true },
    );

    expect(ranges).toEqual({ x2: [2, 3] });
  });

  it("ignores everything that is not an x range", () => {
    const current = { x: [0, 1] as const };

    expect(
      rangesAfterRelayout(current, { autosize: true, "yaxis.range[0]": 4, dragmode: "pan" }),
    ).toEqual(current);
  });
});
