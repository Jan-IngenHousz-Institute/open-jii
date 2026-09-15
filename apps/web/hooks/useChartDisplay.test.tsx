import { act, renderHook } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { toggleChartDisplay, useChartDisplay } from "./useChartDisplay";

describe("toggleChartDisplay", () => {
  it("pins a trace when nothing is pinned yet", () => {
    const result = toggleChartDisplay(null, [1, 2, 3], "col_a", "row_1");
    expect(result).toEqual({
      data: [1, 2, 3],
      columnName: "col_a",
      rowId: "row_1",
      isPinned: true,
    });
  });

  it("unpins when the same row and column are clicked again", () => {
    const prev = { data: [1, 2, 3], columnName: "col_a", rowId: "row_1", isPinned: true };
    const result = toggleChartDisplay(prev, [1, 2, 3], "col_a", "row_1");
    expect(result).toBeNull();
  });

  it("switches to a different row's trace in the same column instead of unpinning", () => {
    const prev = { data: [1, 2, 3], columnName: "col_a", rowId: "row_1", isPinned: true };
    const result = toggleChartDisplay(prev, [4, 5, 6], "col_a", "row_2");
    expect(result).toEqual({
      data: [4, 5, 6],
      columnName: "col_a",
      rowId: "row_2",
      isPinned: true,
    });
  });

  it("switches to a different column for the same row", () => {
    const prev = { data: [1, 2, 3], columnName: "col_a", rowId: "row_1", isPinned: true };
    const result = toggleChartDisplay(prev, [7, 8, 9], "col_b", "row_1");
    expect(result).toEqual({
      data: [7, 8, 9],
      columnName: "col_b",
      rowId: "row_1",
      isPinned: true,
    });
  });
});

describe("useChartDisplay", () => {
  it("starts with nothing pinned", () => {
    const { result } = renderHook(() => useChartDisplay());
    expect(result.current.chartDisplay).toBeNull();
  });

  it("pins the clicked trace on toggleChartPin", () => {
    const { result } = renderHook(() => useChartDisplay());
    act(() => result.current.toggleChartPin([1, 2, 3], "col_a", "row_1"));
    expect(result.current.chartDisplay).toEqual({
      data: [1, 2, 3],
      columnName: "col_a",
      rowId: "row_1",
      isPinned: true,
    });
  });

  it("unpins on a repeat click of the same row and column", () => {
    const { result } = renderHook(() => useChartDisplay());
    act(() => result.current.toggleChartPin([1, 2, 3], "col_a", "row_1"));
    act(() => result.current.toggleChartPin([1, 2, 3], "col_a", "row_1"));
    expect(result.current.chartDisplay).toBeNull();
  });

  it("switches trace instead of unpinning when a different row is clicked", () => {
    const { result } = renderHook(() => useChartDisplay());
    act(() => result.current.toggleChartPin([1, 2, 3], "col_a", "row_1"));
    act(() => result.current.toggleChartPin([4, 5, 6], "col_a", "row_2"));
    expect(result.current.chartDisplay).toEqual({
      data: [4, 5, 6],
      columnName: "col_a",
      rowId: "row_2",
      isPinned: true,
    });
  });

  it("closePinnedChart clears the pinned chart", () => {
    const { result } = renderHook(() => useChartDisplay());
    act(() => result.current.toggleChartPin([1, 2, 3], "col_a", "row_1"));
    act(() => result.current.closePinnedChart());
    expect(result.current.chartDisplay).toBeNull();
  });
});
