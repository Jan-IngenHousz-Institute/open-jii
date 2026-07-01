import { act, renderHook } from "@/test/test-utils";
import * as nav from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { useUrlDataFilters } from "./useUrlDataFilters";

function setSearchParams(qs: string): void {
  vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
}

const mockedReplace = vi.mocked(nav.useRouter()).replace;

const encodeFilters = (f: ExperimentDataFilter[]) => encodeURIComponent(JSON.stringify(f));

describe("useUrlDataFilters", () => {
  beforeEach(() => {
    mockedReplace.mockClear();
    setSearchParams("");
    vi.mocked(nav.usePathname).mockReturnValue("/platform/experiments/abc/data");
  });

  afterEach(() => {
    vi.mocked(nav.useSearchParams).mockReset();
  });

  it("starts empty when the URL has no filter param", () => {
    const { result } = renderHook(() => useUrlDataFilters("raw_data"));
    expect(result.current.filters).toEqual([]);
    expect(result.current.completeFilters).toEqual([]);
  });

  it("seeds filters from the f_<table> URL param", () => {
    const seed: ExperimentDataFilter[] = [{ column: "device_id", operator: "equals", value: "D1" }];
    setSearchParams(`f_raw_data=${encodeFilters(seed)}`);

    const { result } = renderHook(() => useUrlDataFilters("raw_data"));

    expect(result.current.filters).toEqual(seed);
    expect(result.current.completeFilters).toEqual(seed);
  });

  it("namespaces filters per table so two tabs don't collide", () => {
    const a: ExperimentDataFilter[] = [{ column: "device_id", operator: "equals", value: "D1" }];
    const b: ExperimentDataFilter[] = [{ column: "lot", operator: "equals", value: "L42" }];
    setSearchParams(`f_raw_data=${encodeFilters(a)}&f_device=${encodeFilters(b)}`);

    const rawHook = renderHook(() => useUrlDataFilters("raw_data"));
    expect(rawHook.result.current.filters).toEqual(a);

    const deviceHook = renderHook(() => useUrlDataFilters("device"));
    expect(deviceHook.result.current.filters).toEqual(b);
  });

  it("falls back to empty when the URL JSON is malformed", () => {
    setSearchParams("f_raw_data=not-json");
    const { result } = renderHook(() => useUrlDataFilters("raw_data"));
    expect(result.current.filters).toEqual([]);
  });

  it("writes the complete-filter subset to the URL when filters change", () => {
    const { result } = renderHook(() => useUrlDataFilters("raw_data"));

    const next: ExperimentDataFilter[] = [{ column: "device_id", operator: "equals", value: "D1" }];
    act(() => {
      result.current.setFilters(next);
    });

    expect(mockedReplace).toHaveBeenCalled();
    const written = mockedReplace.mock.calls.at(-1)?.[0];
    expect(typeof written).toBe("string");
    if (typeof written === "string") {
      expect(written).toContain(`f_raw_data=${encodeFilters(next)}`);
    }
  });

  it("keeps a draft row visible without writing it to the URL", () => {
    const { result } = renderHook(() => useUrlDataFilters("raw_data"));
    mockedReplace.mockClear();

    act(() => {
      result.current.setFilters([{ column: "device_id", operator: "equals", value: "" }]);
    });

    expect(result.current.filters).toHaveLength(1);
    expect(result.current.completeFilters).toEqual([]);
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it("clears the URL param when the last complete filter is removed", () => {
    const seed: ExperimentDataFilter[] = [{ column: "device_id", operator: "equals", value: "D1" }];
    setSearchParams(`f_raw_data=${encodeFilters(seed)}`);
    const { result } = renderHook(() => useUrlDataFilters("raw_data"));
    mockedReplace.mockClear();

    act(() => {
      result.current.setFilters([]);
    });

    expect(mockedReplace).toHaveBeenCalled();
    const written = mockedReplace.mock.calls.at(-1)?.[0];
    expect(typeof written).toBe("string");
    if (typeof written === "string") {
      expect(written).not.toContain("f_raw_data=");
    }
  });

  it("re-seeds local state when the URL param changes externally (back/forward)", () => {
    const seed: ExperimentDataFilter[] = [{ column: "device_id", operator: "equals", value: "D1" }];
    const next: ExperimentDataFilter[] = [{ column: "device_id", operator: "equals", value: "D2" }];
    setSearchParams(`f_raw_data=${encodeFilters(seed)}`);

    const { result, rerender } = renderHook(() => useUrlDataFilters("raw_data"));
    expect(result.current.filters).toEqual(seed);

    setSearchParams(`f_raw_data=${encodeFilters(next)}`);
    rerender();

    expect(result.current.filters).toEqual(next);
  });
});
