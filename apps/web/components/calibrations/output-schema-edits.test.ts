import { describe, expect, it } from "vitest";

import type { CalibrationOutputSchema } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { zCalibrationOutputSchema } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import {
  addBlock,
  removeBlock,
  removeCoefficient,
  renameBlock,
  renameCoefficient,
  retypeCoefficient,
  setCoefficient,
  specForWritable,
  uniqueName,
  withBound,
  withLength,
} from "./output-schema-edits";

const schema: CalibrationOutputSchema = {
  blocks: {
    par: {
      slope: { type: "number", min: 0.1, max: 10 },
      intercept: { type: "number" },
    },
    spec: {
      channel_coefficients: { type: "number_array", length: 10 },
    },
  },
};

describe("block edits", () => {
  it("renames a block without moving it or losing what it holds", () => {
    const renamed = renameBlock(schema, "par", "light");

    expect(Object.keys(renamed.blocks)).toEqual(["light", "spec"]);
    expect(renamed.blocks.light).toEqual(schema.blocks.par);
    expect(zCalibrationOutputSchema.safeParse(renamed).success).toBe(true);
  });

  it("adds an empty block and removes one", () => {
    const added = addBlock(schema, "baseline");

    expect(added.blocks.baseline).toEqual({});
    expect(Object.keys(removeBlock(added, "baseline").blocks)).toEqual(["par", "spec"]);
  });
});

describe("coefficient edits", () => {
  it("renames a coefficient in place, keeping its spec and its position", () => {
    const renamed = renameCoefficient(schema, "par", "slope", "gain");

    expect(Object.keys(renamed.blocks.par)).toEqual(["gain", "intercept"]);
    expect(renamed.blocks.par.gain).toEqual({ type: "number", min: 0.1, max: 10 });
  });

  it("adds and removes one without touching its neighbours", () => {
    const added = setCoefficient(schema, "par", "offset", { type: "number" });

    expect(Object.keys(added.blocks.par)).toEqual(["slope", "intercept", "offset"]);
    expect(Object.keys(removeCoefficient(added, "par", "slope").blocks.par)).toEqual([
      "intercept",
      "offset",
    ]);
  });
});

describe("retypeCoefficient", () => {
  // An array has to say how many entries it holds, and an author switching to one has
  // not been asked for a number yet.
  it("gives an array a length to start from, and keeps it when the type changes again", () => {
    const asArray = retypeCoefficient({ type: "number", min: 0 }, "number_array");

    expect(asArray).toEqual({ type: "number_array", length: 10, min: 0 });
    expect(
      retypeCoefficient({ type: "number_array", length: 6, min: 0 }, "integer_array"),
    ).toMatchObject({ length: 6 });
  });

  // The contract takes whole bounds only on an integer array, so a fractional one has to
  // go rather than be rounded into something the author did not ask for.
  it("drops bounds an integer array could not carry", () => {
    const whole = retypeCoefficient({ type: "number", min: 0.5, max: 9.5 }, "integer_array");

    expect(whole).toEqual({ type: "integer_array", length: 10 });
    expect(zCalibrationOutputSchema.safeParse({ blocks: { par: { n: whole } } }).success).toBe(
      true,
    );
  });

  it("keeps whole bounds an integer array can carry", () => {
    expect(retypeCoefficient({ type: "number", min: 0, max: 16 }, "integer_array")).toEqual({
      type: "integer_array",
      length: 10,
      min: 0,
      max: 16,
    });
  });
});

describe("withBound and withLength", () => {
  it("sets a bound and clears it again", () => {
    const bounded = withBound({ type: "number" }, "max", 5);

    expect(bounded).toEqual({ type: "number", max: 5 });
    expect(withBound(bounded, "max", undefined)).toEqual({ type: "number" });
  });

  it("leaves a plain number without a length to set", () => {
    expect(withLength({ type: "number" }, 4)).toEqual({ type: "number" });
    expect(withLength({ type: "number_array", length: 10 }, 4)).toEqual({
      type: "number_array",
      length: 4,
    });
  });
});

describe("specForWritable", () => {
  // A per-channel coefficient is submitted as an array; declaring it as a number would
  // make the first real fit fail validation.
  it("declares a per-channel coefficient as an array", () => {
    expect(specForWritable({ name: "channel_coefficients", isArray: true })).toMatchObject({
      type: "number_array",
    });
    expect(specForWritable({ name: "slope", isArray: false })).toEqual({ type: "number" });
  });

  // A vector written in one command has exactly as many entries as that command carries,
  // which the writer knows and the author should not have to count.
  it("takes the length from the writer where it knows one", () => {
    expect(specForWritable({ name: "channels", isArray: true, length: 6 })).toEqual({
      type: "number_array",
      length: 6,
    });
  });
});

describe("uniqueName", () => {
  it("numbers from the second", () => {
    expect(uniqueName("block", [])).toBe("block");
    expect(uniqueName("block", ["block"])).toBe("block_2");
    expect(uniqueName("block", ["block", "block_2"])).toBe("block_3");
  });
});
