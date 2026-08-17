import { describe, expect, it } from "vitest";

import { partitionMacroOutput } from "./partition-macro-output";

describe("partitionMacroOutput", () => {
  it("sorts numeric series into charts and scalars into values", () => {
    const result = partitionMacroOutput([{ phi2: 0.82, label: "leaf 3", trace: [1, 2, 3] }]);

    expect(result.charts).toEqual([{ kind: "chart", name: "trace", values: [1, 2, 3] }]);
    expect(result.values).toEqual([
      { kind: "value", name: "phi2", value: "0.82" },
      { kind: "value", name: "label", value: "leaf 3" },
    ]);
    expect(result.isEmpty).toBe(false);
  });

  it("keeps booleans, including false, which read as a result", () => {
    const result = partitionMacroOutput([{ orientation_valid: false }]);

    expect(result.values).toEqual([{ kind: "value", name: "orientation_valid", value: "false" }]);
    expect(result.empties).toEqual([]);
  });

  it("reports fields the macro measured no value for instead of dropping them", () => {
    const result = partitionMacroOutput([
      { compass_deg: null, pitch_deg: undefined, note: "", nan: Number.NaN, empty: [] },
    ]);

    expect(result.empties.map((f) => f.name)).toEqual([
      "compass_deg",
      "pitch_deg",
      "note",
      "nan",
      "empty",
    ]);
    expect(result.values).toEqual([]);
    expect(result.isEmpty).toBe(false);
  });

  it("keeps structured output as JSON rather than discarding it", () => {
    const result = partitionMacroOutput([{ order: ["a", "b"], meta: { device: "ambit" } }]);

    expect(result.others.map((f) => f.name)).toEqual(["order", "meta"]);
    expect(result.others[0].json).toBe(JSON.stringify(["a", "b"], null, 2));
  });

  it("ignores the messages field, which renders on its own", () => {
    const result = partitionMacroOutput([{ messages: { info: ["hi"] } }]);

    expect(result.isEmpty).toBe(true);
    expect(result.values).toEqual([]);
  });

  it("treats a mixed array as structured, not as a chart", () => {
    const result = partitionMacroOutput([{ mixed: [1, "two", 3] }]);

    expect(result.charts).toEqual([]);
    expect(result.others.map((f) => f.name)).toEqual(["mixed"]);
  });

  it("flattens every output of a multi-output run", () => {
    const result = partitionMacroOutput([{ a: 1 }, { b: 2 }]);

    expect(result.values.map((f) => f.name)).toEqual(["a", "b"]);
  });

  it("is empty for no outputs at all", () => {
    expect(partitionMacroOutput(undefined).isEmpty).toBe(true);
    expect(partitionMacroOutput([]).isEmpty).toBe(true);
  });
});
