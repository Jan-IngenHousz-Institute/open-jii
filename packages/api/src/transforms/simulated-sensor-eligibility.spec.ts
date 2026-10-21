import { describe, expect, it } from "vitest";

import { simulatedSensorsEnabled } from "./simulated-sensor-eligibility";

describe("simulatedSensorsEnabled", () => {
  it.each([
    [undefined, false],
    [null, false],
    [{}, false],
    [{ organizationType: null }, false],
    [{ organizationType: "university" }, false],
    [{ organizationType: "research_institute" }, false],
    [{ organizationType: "non_profit" }, false],
    [{ organizationType: "private_company" }, false],
    [{ organizationType: "government_agency" }, false],
    [{ organizationType: "Demo" }, false],
    [{ organizationType: "demo" }, true],
    [{ name: "openJII Demo", role: "admin", slug: "demo" }, false],
  ])("checks only the experiment's organization type: %j", (experiment, expected) => {
    expect(simulatedSensorsEnabled(experiment)).toBe(expected);
  });
});
