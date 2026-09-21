import { describe, expect, it } from "vitest";

import {
  MACRO_INPUT_REF_KEY,
  elideMacroInputFromContext,
  restoreMacroInputInContext,
} from "./macro-context-ref";

const scan = { protocol_id: "p1", set: [{ label: "a" }], set_repeats: 1, v_arrays: [] };
const measurement = { sample: [scan] };
const ref = { [MACRO_INPUT_REF_KEY]: true };

describe("elideMacroInputFromContext", () => {
  it("replaces the entry holding the macro's own input", () => {
    const ctx = { measurement_node: scan, plant_name: { answer: "maize" } };

    expect(elideMacroInputFromContext(ctx, measurement)).toEqual({
      measurement_node: ref,
      plant_name: { answer: "maize" },
    });
  });

  it("replaces every entry that holds it, not only the first", () => {
    const ctx = { first: scan, second: scan };

    expect(elideMacroInputFromContext(ctx, measurement)).toEqual({ first: ref, second: ref });
  });

  it("leaves an entry that merely resembles the input", () => {
    const ctx = { nearly: { ...scan, set_repeats: 2 } };

    expect(elideMacroInputFromContext(ctx, measurement)).toEqual(ctx);
  });

  it("leaves the context alone when the input projects to nothing", () => {
    const ctx = { measurement_node: scan };

    expect(elideMacroInputFromContext(ctx, { sample: [] })).toEqual(ctx);
  });

  it("does not mutate the context it is given", () => {
    const ctx = { measurement_node: scan };
    elideMacroInputFromContext(ctx, measurement);

    expect(ctx.measurement_node).toBe(scan);
  });
});

describe("restoreMacroInputInContext", () => {
  it("puts the input back where the marker is", () => {
    const elided = elideMacroInputFromContext(
      { measurement_node: scan, plant_name: { answer: "maize" } },
      measurement,
    );

    expect(restoreMacroInputInContext(elided, measurement)).toEqual({
      measurement_node: scan,
      plant_name: { answer: "maize" },
    });
  });

  it("passes through a context written before the marker existed", () => {
    const inline = { measurement_node: scan, plant_name: { answer: "maize" } };

    expect(restoreMacroInputInContext(inline, measurement)).toEqual(inline);
  });

  it("drops the macros key the upload injected into the sample", () => {
    // What arrives from the lakehouse is the uploaded entry, which carries the
    // routing list; the value the macro read on the device did not.
    const uploaded = { sample: [{ ...scan, macros: ["analysis.py"] }] };

    expect(restoreMacroInputInContext({ measurement_node: ref }, uploaded)).toEqual({
      measurement_node: scan,
    });
  });

  it("ignores a lookalike whose marker key is not true", () => {
    const lookalike = { [MACRO_INPUT_REF_KEY]: false };

    expect(restoreMacroInputInContext({ output: lookalike }, measurement)).toEqual({
      output: lookalike,
    });
  });

  it("leaves a marker-shaped value carrying other keys alone", () => {
    const lookalike = { [MACRO_INPUT_REF_KEY]: true, extra: 1 };

    expect(restoreMacroInputInContext({ output: lookalike }, measurement)).toEqual({
      output: lookalike,
    });
  });
});
