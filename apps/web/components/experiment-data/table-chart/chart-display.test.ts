import { describe, it, expect } from "vitest";

import { toggleChartDisplay } from "./chart-display";

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
