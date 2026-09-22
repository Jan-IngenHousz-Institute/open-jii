import { describe, expect, it } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { readSources, setpointTargets } from "./rig-sources";

const BENCH: CaptureProcedure = {
  instruments: [
    { role: "dut" },
    { role: "lamp", handshake: "KIPRIM", model: "kiprim-dc" },
    { role: "par_ref", handshake: "Par_REF", model: "minipar-reference" },
  ],
  steps: [{ kind: "settle", ms: 1000 }],
};

describe("readSources", () => {
  // A supply drives and answers nothing, so a reading pointed at it has no command behind
  // it and fails at the bench rather than on the page.
  it("leaves out an instrument with nothing to read", () => {
    expect(readSources(BENCH, "minipar").map((source) => source.role)).toEqual(["dut", "par_ref"]);
  });

  it("keeps the device even though its commands are only the documented ones", () => {
    const device = readSources(BENCH, "minipar").find((source) => source.role === "dut");

    expect(device?.isExhaustive).toBe(false);
  });
});

describe("setpointTargets", () => {
  it("offers the roles with something to drive, and not the ones without", () => {
    expect(setpointTargets(BENCH, "minipar").map((target) => target.role)).toEqual(["lamp"]);
  });
});
