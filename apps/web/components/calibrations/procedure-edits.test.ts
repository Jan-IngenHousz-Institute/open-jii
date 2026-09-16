import { describe, expect, it } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { zCaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import {
  addInstrument,
  instrumentRoleUsage,
  removeInstrument,
  renameInstrumentRole,
  uniqueRole,
} from "./procedure-edits";

const procedure: CaptureProcedure = {
  instruments: [
    { role: "dut" },
    { role: "lamp", handshake: "KIPRIM", model: "kiprim-dc" },
    { role: "par_ref", handshake: "Par_REF", model: "minipar-reference" },
  ],
  steps: [
    { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
    {
      kind: "sweep",
      series: "par_sweep",
      stimulus: { instrument: "lamp", set: "current_a", values: [0.8, 2.4] },
      read: [
        { instrument: "dut", command: "get_par", as: "par" },
        { instrument: "par_ref", command: "par", as: "par_ref" },
      ],
    },
  ],
  verify: [
    {
      kind: "read",
      series: "par_check",
      read: [{ instrument: "par_ref", command: "par", as: "par_ref" }],
    },
  ],
};

describe("renameInstrumentRole", () => {
  // A role is a name the steps point at, so renaming it in the rig alone leaves a
  // procedure the contract refuses and the bench could not run.
  it("renames the role everywhere the procedure names it", () => {
    const renamed = renameInstrumentRole(procedure, "lamp", "supply");

    expect(renamed.instruments[1]).toEqual({
      role: "supply",
      handshake: "KIPRIM",
      model: "kiprim-dc",
    });
    expect(renamed.steps[0]).toMatchObject({ instrument: "supply" });
    expect(renamed.steps[1]).toMatchObject({ stimulus: { instrument: "supply" } });
    expect(zCaptureProcedure.safeParse(renamed).success).toBe(true);
  });

  it("follows a role into the verify phase", () => {
    const renamed = renameInstrumentRole(procedure, "par_ref", "reference");

    expect(renamed.verify?.[0]).toMatchObject({ read: [{ instrument: "reference" }] });
    expect(renamed.steps[1]).toMatchObject({
      read: [{ instrument: "dut" }, { instrument: "reference" }],
    });
  });

  it("leaves every other role where it was", () => {
    const renamed = renameInstrumentRole(procedure, "lamp", "supply");

    expect(renamed.instruments[0]).toEqual({ role: "dut" });
    expect(renamed.steps[1]).toMatchObject({
      read: [{ instrument: "dut" }, { instrument: "par_ref" }],
    });
  });
});

describe("instrumentRoleUsage", () => {
  it("counts the steps that name each role, over both phases", () => {
    expect(instrumentRoleUsage(procedure)).toEqual({ dut: 1, lamp: 2, par_ref: 2 });
  });

  it("reports a role nothing names as absent, so it can be removed", () => {
    const withSpare = addInstrument(procedure, {
      role: "spare",
      handshake: "KIPRIM",
      model: "kiprim-dc",
    });

    expect(instrumentRoleUsage(withSpare).spare).toBeUndefined();
    expect(removeInstrument(withSpare, "spare").instruments).toHaveLength(3);
  });
});

describe("uniqueRole", () => {
  it("turns a model name into a role, numbered until nothing holds it", () => {
    expect(uniqueRole("kiprim_dc", [])).toBe("kiprim_dc");
    expect(uniqueRole("kiprim_dc", ["kiprim_dc"])).toBe("kiprim_dc_2");
    expect(uniqueRole("kiprim_dc", ["kiprim_dc", "kiprim_dc_2"])).toBe("kiprim_dc_3");
  });
});
