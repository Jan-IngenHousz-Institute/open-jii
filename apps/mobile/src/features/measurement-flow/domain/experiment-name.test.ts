import { describe, expect, it } from "vitest";

import { resolveExperimentName } from "./experiment-name";

const experiments = [
  { value: "exp-A", label: "Wheat Trial 2026" },
  { value: "exp-B", label: "Rice Salinity" },
];

describe("resolveExperimentName", () => {
  it("uses the live-query label when the experiment is in the loaded list", () => {
    expect(
      resolveExperimentName({
        experimentLabel: undefined,
        experiments,
        experimentId: "exp-B",
        fallback: "Experiment",
      }),
    ).toBe("Rice Salinity");
  });

  // Regression: the "experiment name disappears, just says 'Experiment'" bug.
  // On cold resume / offline the query is empty, but the label captured at
  // selection is persisted with the flow and must win.
  it("prefers the persisted experimentLabel over an empty/stale live list", () => {
    // The old live-only lookup loses the name when the query has not loaded.
    const notLoaded: typeof experiments = [];
    const buggy = notLoaded.find((e) => e.value === "exp-A")?.label ?? "Experiment";
    expect(buggy).toBe("Experiment");

    expect(
      resolveExperimentName({
        experimentLabel: "Wheat Trial 2026",
        experiments: notLoaded,
        experimentId: "exp-A",
        fallback: "Experiment",
      }),
    ).toBe("Wheat Trial 2026");
  });

  it("treats a blank label as absent and falls back to the query", () => {
    expect(
      resolveExperimentName({
        experimentLabel: "   ",
        experiments,
        experimentId: "exp-A",
        fallback: "Experiment",
      }),
    ).toBe("Wheat Trial 2026");
  });

  it("falls back to the default only when neither label nor query has a name", () => {
    expect(
      resolveExperimentName({
        experimentLabel: undefined,
        experiments: [],
        experimentId: "exp-A",
        fallback: "Experiment",
      }),
    ).toBe("Experiment");
  });
});
