import { describe, expect, it } from "vitest";

import { setpointRamp } from "./setpoint-ramp";

describe("setpointRamp", () => {
  it("spaces the points evenly from one setting to the other, ends included", () => {
    expect(setpointRamp(0, 800, 5)).toEqual([0, 200, 400, 600, 800]);
  });

  // A tenth of a range is rarely a round number, and 0.30000000000000004 is not a setting.
  it("drops the noise of dividing a range", () => {
    expect(setpointRamp(0.1, 0.5, 5)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
  });

  it("ramps downwards as readily as up", () => {
    expect(setpointRamp(250, 0, 3)).toEqual([250, 125, 0]);
  });

  // Fewer than two points is not a ramp, and the contract caps a sweep at 64.
  it("refuses a range it cannot ramp", () => {
    expect(setpointRamp(0, 10, 1)).toEqual([]);
    expect(setpointRamp(0, 10, 65)).toEqual([]);
    expect(setpointRamp(Number.NaN, 10, 5)).toEqual([]);
  });
});
