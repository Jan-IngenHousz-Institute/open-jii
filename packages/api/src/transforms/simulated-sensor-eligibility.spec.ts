import { describe, expect, it } from "vitest";

import { simulatedSensorsEnabled } from "./simulated-sensor-eligibility";

describe("simulatedSensorsEnabled", () => {
  it.each([
    [undefined, false],
    [null, false],
    [{ organizationType: null }, false],
    [{ organizationType: "university" }, false],
    [{ organizationType: "research_institute" }, false],
    [{ organizationType: "non_profit" }, false],
    [{ organizationType: "private_company" }, false],
    [{ organizationType: "government_agency" }, false],
    [{ organizationType: "demo" }, true],
  ] as const)("checks only the experiment's organization type: %j", (experiment, expected) => {
    expect(simulatedSensorsEnabled(experiment)).toBe(expected);
  });
});
