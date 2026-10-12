import { describe, expect, it } from "vitest";

import { plannedPositions, sortOrderAt } from "./ordering.js";

describe("plannedPositions", () => {
  it("keeps Linear's numbers when everything exists and is already in order", () => {
    expect(plannedPositions([3.5, 7.25, 90])).toEqual([3.5, 7.25, 90]);
  });

  it("respaces by a thousand when an item is new or the order is wrong", () => {
    expect(plannedPositions([3.5, null, 90])).toEqual([1000, 2000, 3000]);
    expect(plannedPositions([90, 3.5])).toEqual([1000, 2000]);
    expect(plannedPositions([5, 5])).toEqual([1000, 2000]);
    expect(sortOrderAt(4)).toBe(4000);
  });
});
