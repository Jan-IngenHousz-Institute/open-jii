import { describe, expect, it } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { producedSeries } from "./produced-series";

const PROCEDURE: CaptureProcedure = {
  instruments: [
    { role: "dut" },
    { role: "lamp", handshake: "KIPRIM" },
    { role: "par_ref", handshake: "Par_REF" },
  ],
  steps: [
    { kind: "operator", prompt: "Cover the sensor" },
    { kind: "set", instrument: "lamp", set: "current", value: 0 },
    {
      kind: "sweep",
      series: "par_sweep",
      stimulus: { instrument: "lamp", set: "current", values: [0, 0.8, 2.4] },
      read: [
        { instrument: "dut", command: "par_raw", as: "par_raw" },
        { instrument: "par_ref", command: "par", as: "par_ref" },
      ],
    },
    {
      kind: "read",
      series: "dark",
      optional: true,
      read: [{ instrument: "dut", command: "par_raw", as: "dark_raw" }],
    },
  ],
  verify: [
    {
      kind: "read",
      series: "par_check",
      read: [{ instrument: "dut", command: "par", as: "par" }],
    },
  ],
};

describe("producedSeries", () => {
  it("names each series the way the fit addresses it, with its columns", () => {
    expect(producedSeries(PROCEDURE, "steps")).toEqual([
      // A sweep writes the setpoint it drove beside every reading taken at it.
      { name: "par_sweep", columns: ["stimulus", "par_raw", "par_ref"], optional: false },
      { name: "dark", columns: ["dark_raw"], optional: true },
    ]);
  });

  it("reads the verify phase separately, since it runs after the write", () => {
    expect(producedSeries(PROCEDURE, "verify")).toEqual([
      { name: "par_check", columns: ["par"], optional: false },
    ]);
  });

  // Steps that neither read nor sweep put nothing in the payload, so the fit never sees them.
  it("ignores the steps that record nothing", () => {
    const prompts: CaptureProcedure = {
      instruments: [{ role: "dut" }],
      steps: [
        { kind: "operator", prompt: "Cover the sensor" },
        { kind: "settle", ms: 1000 },
      ],
    };

    expect(producedSeries(prompts, "steps")).toEqual([]);
  });

  // Two steps may write one series; the payload then carries both sets of columns, and the
  // series arrives as long as either step always runs.
  it("merges two steps that write the same series", () => {
    const shared: CaptureProcedure = {
      instruments: [{ role: "dut" }],
      steps: [
        {
          kind: "read",
          series: "reading",
          optional: true,
          read: [{ instrument: "dut", command: "par", as: "par" }],
        },
        {
          kind: "read",
          series: "reading",
          read: [{ instrument: "dut", command: "temp", as: "temp" }],
        },
      ],
    };

    expect(producedSeries(shared, "steps")).toEqual([
      { name: "reading", columns: ["par", "temp"], optional: false },
    ]);
  });
});
