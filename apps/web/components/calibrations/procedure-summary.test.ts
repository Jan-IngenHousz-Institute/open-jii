import { describe, expect, it } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { phaseSummary } from "./procedure-summary";

const procedure: CaptureProcedure = {
  instruments: [{ role: "dut" }, { role: "lamp", handshake: "KIPRIM", model: "kiprim-dc" }],
  steps: [
    { kind: "operator", prompt: "Cover the sensor" },
    { kind: "settle", ms: 2_000 },
    { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
    {
      kind: "read",
      series: "dark",
      read: [{ instrument: "dut", command: "par", as: "par", repeat: 4, intervalMs: 250 }],
    },
    {
      kind: "sweep",
      series: "ramp",
      stimulus: { instrument: "lamp", set: "current_a", values: [0, 2, 4, 6] },
      settleMs: 1_000,
      read: [{ instrument: "dut", command: "par", as: "par" }],
    },
  ],
  verify: [
    { kind: "read", series: "check", read: [{ instrument: "dut", command: "par", as: "par" }] },
  ],
};

describe("phaseSummary", () => {
  it("counts a sweep once per setpoint and a reading once", () => {
    expect(phaseSummary(procedure, "steps").points).toBe(5);
  });

  // The number an author is deciding about: four points that settle for a second each cost
  // four seconds, not one.
  it("totals the waiting the procedure declares for itself", () => {
    // 2s settle, 3 gaps of 250ms between repeated samples, 4 setpoints settling 1s each.
    expect(phaseSummary(procedure, "steps").waitMs).toBe(2_000 + 750 + 4_000);
  });

  it("counts every step that stops for a person", () => {
    expect(phaseSummary(procedure, "steps").stops).toBe(1);
  });

  it("summarises the verification on its own", () => {
    expect(phaseSummary(procedure, "verify")).toEqual({
      steps: 1,
      points: 1,
      waitMs: 0,
      stops: 0,
    });
  });

  it("has nothing to report for a phase a definition left out", () => {
    expect(phaseSummary({ ...procedure, verify: undefined }, "verify")).toEqual({
      steps: 0,
      points: 0,
      waitMs: 0,
      stops: 0,
    });
  });
});
