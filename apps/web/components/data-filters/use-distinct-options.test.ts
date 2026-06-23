import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/domains/experiment/experiment.schema";

import {
  chipValueForOption,
  useContributorIdMap,
  useDistinctOptions,
} from "./use-distinct-options";

const labelColumn: ExperimentDataColumn = { name: "label", type_name: "STRING", type_text: "STRING" };
const contributorColumn: ExperimentDataColumn = {
  name: "owner",
  type_name: "STRUCT",
  type_text: WellKnownColumnTypes.CONTRIBUTOR,
};

describe("useDistinctOptions", () => {
  it("returns the fetched values and exposes truncated state", async () => {
    server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: ["alpha", "beta"], truncated: true },
    });

    const { result } = renderHook(() => useDistinctOptions(labelColumn, "exp-1", "raw_data"));

    await waitFor(() => expect(result.current.values).toEqual(["alpha", "beta"]));
    expect(result.current.truncated).toBe(true);
    expect(result.current.isContributor).toBe(false);
    expect(result.current.contributorMap).toBeUndefined();
  });

  it("builds a contributor id->json map for CONTRIBUTOR columns", async () => {
    const struct = JSON.stringify({ id: "u-1", name: "Alice", avatar: null });
    server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: [struct], truncated: false },
    });

    const { result } = renderHook(() => useDistinctOptions(contributorColumn, "exp-1", "raw_data"));

    await waitFor(() => expect(result.current.values).toHaveLength(1));
    expect(result.current.isContributor).toBe(true);
    expect(result.current.contributorMap?.get("u-1")).toBe(struct);
  });

  it("returns empty defaults while loading or when the request errors", async () => {
    server.mount(contract.experiments.getDistinctColumnValues, { status: 404 });

    const { result } = renderHook(() => useDistinctOptions(labelColumn, "exp-1", "raw_data"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.values).toEqual([]);
    expect(result.current.truncated).toBe(false);
  });
});

describe("useContributorIdMap", () => {
  it("returns a map keyed by struct id for valid contributor json strings", () => {
    const a = JSON.stringify({ id: "u-1", name: "A" });
    const b = JSON.stringify({ id: "u-2", name: "B" });
    const { result } = renderHook(() => useContributorIdMap([a, b]));
    expect(result.current?.get("u-1")).toBe(a);
    expect(result.current?.get("u-2")).toBe(b);
  });

  it("skips entries that aren't parseable or lack a string id", () => {
    const valid = JSON.stringify({ id: "u-1", name: "A" });
    const { result } = renderHook(() => useContributorIdMap([valid, "not-json", "{}"]));
    expect(result.current?.size).toBe(1);
    expect(result.current?.get("u-1")).toBe(valid);
  });

  it("returns undefined when disabled", () => {
    const { result } = renderHook(() =>
      useContributorIdMap([JSON.stringify({ id: "u-1", name: "A" })], false),
    );
    expect(result.current).toBeUndefined();
  });
});

describe("chipValueForOption", () => {
  it("passes scalar values through when the column isn't a contributor struct", () => {
    expect(chipValueForOption("hello", false)).toBe("hello");
    expect(chipValueForOption(42, false)).toBe(42);
  });

  it("unwraps the contributor id when the column is a CONTRIBUTOR struct", () => {
    const struct = JSON.stringify({ id: "u-7", name: "G" });
    expect(chipValueForOption(struct, true)).toBe("u-7");
  });

  it("returns the raw value when contributor parsing fails", () => {
    expect(chipValueForOption("plain", true)).toBe("plain");
  });
});
