import { describe, expect, it } from "vitest";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { zCaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import {
  STEP_KINDS,
  addInstrument,
  addRead,
  addStep,
  instrumentRoleUsage,
  moveStep,
  newStep,
  removeInstrument,
  removeRead,
  removeStep,
  renameInstrumentRole,
  replaceStep,
  stepReads,
  takenSeries,
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

describe("step edits", () => {
  it("adds a step of each kind that the contract already accepts", () => {
    for (const kind of STEP_KINDS) {
      const added = addStep(procedure, "steps", newStep(kind, takenSeries(procedure, "steps")));

      expect(zCaptureProcedure.safeParse(added).success).toBe(true);
    }
  });

  it("moves a step within its phase and leaves the others in order", () => {
    const moved = moveStep(procedure, "steps", 0, 1);

    expect(moved.steps.map((step) => step.kind)).toEqual(["sweep", "set"]);
    expect(moveStep(procedure, "steps", 0, 5)).toEqual(procedure);
  });

  it("replaces and removes a step by position", () => {
    const replaced = replaceStep(procedure, "steps", 0, { kind: "settle", ms: 500 });

    expect(replaced.steps[0]).toEqual({ kind: "settle", ms: 500 });
    expect(removeStep(procedure, "steps", 0).steps).toHaveLength(1);
  });

  // An empty verify phase is not a phase: the contract refuses `verify: []`.
  it("drops the verify phase with its last step, and creates it with its first", () => {
    const emptied = removeStep(procedure, "verify", 0);

    expect(emptied).not.toHaveProperty("verify");
    expect(zCaptureProcedure.safeParse(emptied).success).toBe(true);

    const restored = addStep(emptied, "verify", newStep("settle", []));
    expect(restored.verify).toHaveLength(1);
  });

  it("names each new series once per phase", () => {
    const first = addStep(procedure, "steps", newStep("read", takenSeries(procedure, "steps")));
    const second = addStep(first, "steps", newStep("read", takenSeries(first, "steps")));

    expect(zCaptureProcedure.safeParse(second).success).toBe(true);
  });

  // A step with no reads records nothing, so the last one stays put.
  it("adds and removes readings, keeping one", () => {
    const step = procedure.steps[1];
    const added = addRead(step, { instrument: "dut", command: "par", as: "par" });

    expect(stepReads(added)).toHaveLength(3);
    expect(stepReads(removeRead(added, 0))).toHaveLength(2);
    expect(stepReads(removeRead(newStep("read", []), 0))).toHaveLength(1);
  });
});
