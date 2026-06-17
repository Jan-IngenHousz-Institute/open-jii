import { describe, expect, it } from "vitest";

import { getWidgetMinDimensions } from "./widget-dimensions";

describe("getWidgetMinDimensions", () => {
  it("returns a wider, taller floor for visualization widgets so charts have room", () => {
    expect(getWidgetMinDimensions("visualization")).toEqual({ minW: 3, minH: 4 });
  });

  it("returns the smallest minimum for rich-text widgets", () => {
    expect(getWidgetMinDimensions("richText")).toEqual({ minW: 2, minH: 2 });
  });

  it("caps table widgets at maxH=8 to keep multi-page tables from dominating the grid", () => {
    expect(getWidgetMinDimensions("table")).toEqual({ minW: 4, minH: 3, maxH: 8 });
  });

  it("returns explicit defaults plus a tight ceiling for filter widgets", () => {
    expect(getWidgetMinDimensions("filter")).toEqual({
      minW: 2,
      minH: 2,
      maxH: 3,
      defaultW: 3,
      defaultH: 2,
    });
  });
});
