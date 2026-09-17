import { describe, expect, it } from "vitest";

import { zCreateCalibrationDefinitionBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { starterDefinition } from "./starter-definition";

describe("starterDefinition", () => {
  // A definition cannot exist without a procedure, a script and an output schema, so
  // naming one has to produce all three.
  it("is a definition the contract already accepts", () => {
    const parsed = zCreateCalibrationDefinitionBody.safeParse({
      ...starterDefinition("minipar"),
      name: "New bench",
    });

    expect(parsed.success).toBe(true);
  });

  // Coefficients the platform has no console command for are recorded and never written,
  // and an author has no way to know which is which. Starting from the writable ones
  // means keeping the given names produces a calibration that reaches the hardware.
  it("starts from the blocks the family can be written with", () => {
    const minipar = starterDefinition("minipar");

    expect(Object.keys(minipar.outputSchema.blocks).sort()).toEqual(["par", "spec"]);
    expect(Object.keys(minipar.outputSchema.blocks.par).sort()).toEqual(["intercept", "slope"]);
    // Declaring a per-channel coefficient as a number would fail on the first real fit.
    expect(minipar.outputSchema.blocks.spec.channel_coefficients).toMatchObject({
      type: "number_array",
    });
  });

  // A family the platform cannot write is still worth a definition: the run is recorded.
  it("still produces a usable schema for a family with no writers", () => {
    const multispeq = starterDefinition("multispeq");

    expect(Object.keys(multispeq.outputSchema.blocks)).toHaveLength(1);
    expect(
      zCreateCalibrationDefinitionBody.safeParse({ ...multispeq, name: "New bench" }).success,
    ).toBe(true);
  });

  it("mentions every declared block in the script it starts from", () => {
    const ambit = starterDefinition("ambit");

    for (const block of Object.keys(ambit.outputSchema.blocks)) {
      expect(ambit.script).toContain(`"${block}"`);
    }
  });
});
