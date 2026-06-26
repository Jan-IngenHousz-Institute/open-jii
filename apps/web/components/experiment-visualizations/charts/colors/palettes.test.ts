import { describe, expect, it } from "vitest";

import {
  CATEGORY_PALETTE,
  COLOR_MAP_KEY_SEPARATOR,
  DEFAULT_PRIMARY_COLOR,
  composeColorMapKey,
  getCategoryColor,
  getDefaultSeriesColor,
  withAlpha,
} from "./palettes";

describe("getDefaultSeriesColor", () => {
  it("returns the primary color at index 0", () => {
    expect(getDefaultSeriesColor(0)).toBe(DEFAULT_PRIMARY_COLOR);
  });

  it("is deterministic across calls", () => {
    expect(getDefaultSeriesColor(3)).toBe(getDefaultSeriesColor(3));
  });

  it("wraps past the palette length", () => {
    expect(getDefaultSeriesColor(10)).toBe(getDefaultSeriesColor(0));
  });
});

describe("getCategoryColor", () => {
  it("returns the palette entry at the wrapped index", () => {
    expect(getCategoryColor(0)).toBe(CATEGORY_PALETTE[0]);
    expect(getCategoryColor(CATEGORY_PALETTE.length)).toBe(CATEGORY_PALETTE[0]);
  });

  it("prefers a colorMap match when key is present", () => {
    expect(getCategoryColor(0, { A: "#abcdef" }, "A")).toBe("#abcdef");
  });

  it("falls back to the palette when key is not in the map", () => {
    expect(getCategoryColor(2, { A: "#abcdef" }, "B")).toBe(CATEGORY_PALETTE[2]);
  });

  it("ignores the colorMap when no key is supplied", () => {
    expect(getCategoryColor(0, { A: "#abcdef" })).toBe(CATEGORY_PALETTE[0]);
  });

  it("prefers a composite series::category override over the plain key", () => {
    const composite = composeColorMapKey("revenue_eur", "Hardware");
    const colorMap = { [composite]: "#purple_per_series", Hardware: "#blue_all_series" };
    expect(getCategoryColor(0, colorMap, "Hardware", "revenue_eur")).toBe("#purple_per_series");
  });

  it("falls back to the plain key when the composite has no entry", () => {
    const colorMap = { Hardware: "#blue_all_series" };
    expect(getCategoryColor(0, colorMap, "Hardware", "revenue_eur")).toBe("#blue_all_series");
  });

  it("falls back to the palette when neither composite nor plain hits", () => {
    expect(getCategoryColor(3, {}, "Hardware", "revenue_eur")).toBe(CATEGORY_PALETTE[3]);
  });

  it("does not probe composite lookup when seriesKey is omitted", () => {
    const composite = composeColorMapKey("revenue_eur", "Hardware");
    const colorMap = { [composite]: "#purple_per_series" };
    expect(getCategoryColor(0, colorMap, "Hardware")).toBe(CATEGORY_PALETTE[0]);
  });
});

describe("composeColorMapKey", () => {
  it("joins seriesKey and categoryKey with the documented separator", () => {
    expect(composeColorMapKey("revenue_eur", "Hardware")).toBe(
      `revenue_eur${COLOR_MAP_KEY_SEPARATOR}Hardware`,
    );
  });
});

describe("withAlpha", () => {
  it("packs a 6-digit hex into rgba()", () => {
    expect(withAlpha("#3b82f6", 0.5)).toBe("rgba(59, 130, 246, 0.5)");
  });

  it("expands a 3-digit hex before packing", () => {
    expect(withAlpha("#abc", 1)).toBe("rgba(170, 187, 204, 1)");
  });

  it("returns undefined for an undefined color (opt-in callers)", () => {
    expect(withAlpha(undefined, 0.5)).toBeUndefined();
  });

  it("passes non-hex colors through unchanged", () => {
    expect(withAlpha("rgb(0,0,0)", 0.5)).toBe("rgb(0,0,0)");
    expect(withAlpha("red", 0.5)).toBe("red");
  });

  it("passes hex with unsupported length through unchanged (no 4-digit short alpha)", () => {
    expect(withAlpha("#abcd", 0.5)).toBe("#abcd");
  });

  it("preserves the alpha value verbatim", () => {
    expect(withAlpha("#000000", 0)).toBe("rgba(0, 0, 0, 0)");
    expect(withAlpha("#ffffff", 1)).toBe("rgba(255, 255, 255, 1)");
  });
});
