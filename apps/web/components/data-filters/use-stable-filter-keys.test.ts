import { renderHook } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { useStableFilterKeys } from "./use-stable-filter-keys";

function makeFilter(column: string): ExperimentDataFilter {
  return { column, operator: "equals", value: "x" };
}

describe("useStableFilterKeys", () => {
  it("returns one unique key per filter", () => {
    const filters = [makeFilter("a"), makeFilter("b")];
    const { result } = renderHook(() => useStableFilterKeys(filters));
    expect(result.current).toHaveLength(2);
    expect(new Set(result.current).size).toBe(2);
  });

  it("returns the same keys when the input array reference is stable", () => {
    const filters = [makeFilter("a")];
    const { result, rerender } = renderHook(({ value }) => useStableFilterKeys(value), {
      initialProps: { value: filters },
    });
    const first = result.current;
    rerender({ value: filters });
    expect(result.current).toBe(first);
  });

  it("preserves keys for filters that survive when one is removed", () => {
    const a = makeFilter("a");
    const b = makeFilter("b");
    const c = makeFilter("c");
    const { result, rerender } = renderHook(({ value }) => useStableFilterKeys(value), {
      initialProps: { value: [a, b, c] },
    });
    const [, keyB, keyC] = result.current;
    rerender({ value: [b, c] });
    expect(result.current).toEqual([keyB, keyC]);
  });

  it("mints a new key only for the appended filter", () => {
    const a = makeFilter("a");
    const b = makeFilter("b");
    const { result, rerender } = renderHook(({ value }) => useStableFilterKeys(value), {
      initialProps: { value: [a] },
    });
    const [keyA] = result.current;
    rerender({ value: [a, b] });
    expect(result.current[0]).toBe(keyA);
    expect(result.current[1]).not.toBe(keyA);
  });

  it("returns an empty array for no filters", () => {
    const empty: ExperimentDataFilter[] = [];
    const { result } = renderHook(() => useStableFilterKeys(empty));
    expect(result.current).toEqual([]);
  });
});
