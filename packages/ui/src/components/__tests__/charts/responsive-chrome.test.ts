import { describe, expect, it } from "vitest";

import type { PlotlyChartConfig } from "../../charts/types";
import {
  createBaseLayout,
  extendLayoutForFacets,
  responsiveChrome,
  tierAxisFontSizes,
  truncateCategoryTicks,
  truncateTickLabel,
} from "../../charts/utils";

describe("responsiveChrome", () => {
  const config: PlotlyChartConfig = { title: "Chart", legendPosition: "right" };

  it("matches createBaseLayout's chrome slice exactly (single source of truth)", () => {
    const base = createBaseLayout(config, { compact: true });
    const chrome = responsiveChrome(config, { compact: true });
    expect(chrome.title).toEqual(base.title);
    expect(chrome.legend).toEqual(base.legend);
    expect(chrome.margin).toEqual(base.margin);
    expect(chrome.font).toEqual(base.font);
    expect(chrome.showlegend).toBe(base.showlegend);
    expect(chrome.paper_bgcolor).toBe(base.paper_bgcolor);
    expect(chrome.autosize).toBe(base.autosize);
  });

  it("carries no cartesian axes", () => {
    const chrome = responsiveChrome(config);
    expect(chrome).not.toHaveProperty("xaxis");
    expect(chrome).not.toHaveProperty("yaxis");
  });

  it("shrinks margins as tiers tighten", () => {
    const full = responsiveChrome(config);
    const veryCompact = responsiveChrome(config, { veryCompact: true });
    expect(veryCompact.margin?.l ?? 0).toBeLessThan(full.margin?.l ?? 0);
    expect(veryCompact.margin?.t ?? 0).toBeLessThan(full.margin?.t ?? 0);
  });

  it("shrinks the chart title font per tier", () => {
    const full = responsiveChrome(config);
    const compact = responsiveChrome(config, { compact: true });
    const fullSize = (full.title as { font?: { size?: number } }).font?.size ?? 0;
    const compactSize = (compact.title as { font?: { size?: number } }).font?.size ?? 0;
    expect(compactSize).toBeLessThan(fullSize);
  });
});

describe("tierAxisFontSizes", () => {
  it("mirrors the tick/axis-title tiers of createBaseLayout", () => {
    expect(tierAxisFontSizes()).toEqual({ tick: 12, axisTitle: 14 });
    expect(tierAxisFontSizes({ snug: true })).toEqual({ tick: 11, axisTitle: 13 });
    expect(tierAxisFontSizes({ compact: true })).toEqual({ tick: 10, axisTitle: 11 });
    expect(tierAxisFontSizes({ veryCompact: true })).toEqual({ tick: 9, axisTitle: 10 });
  });
});

describe("truncateTickLabel", () => {
  it("ellipsizes past the tier's char budget", () => {
    const long = "Usefulness of materials in the field";
    expect(truncateTickLabel(long, { veryCompact: true })).toBe("Usefuln…");
    expect(truncateTickLabel(long, { veryCompact: true })).toHaveLength(8);
  });

  it("leaves short labels alone", () => {
    expect(truncateTickLabel("Yield", { veryCompact: true })).toBe("Yield");
  });
});

describe("truncateCategoryTicks", () => {
  const longCategories = [
    "Clarity of instructions",
    "Instructor responsiveness",
    "Usefulness of materials",
  ];

  it("no-ops on non-category axes", () => {
    const axis = { type: "linear" as const };
    expect(truncateCategoryTicks(axis, longCategories, { compact: true })).toBe(axis);
  });

  it("no-ops when explicit ticks are already set", () => {
    const axis = { type: "category" as const, tickvals: ["a"], ticktext: ["A"] };
    expect(truncateCategoryTicks(axis, longCategories, { compact: true })).toBe(axis);
  });

  it("no-ops when every label fits the budget", () => {
    const axis = { type: "category" as const };
    expect(truncateCategoryTicks(axis, ["A", "B"], { compact: true })).toBe(axis);
  });

  it("emits value-anchored tickvals with ellipsized ticktext", () => {
    const axis = truncateCategoryTicks({ type: "category" }, longCategories, { compact: true });
    expect(axis.tickmode).toBe("array");
    // tickvals keep the FULL values so ticks anchor to the right category.
    expect(axis.tickvals).toEqual(longCategories);
    for (const label of axis.ticktext ?? []) {
      expect(String(label).length).toBeLessThanOrEqual(12);
    }
    expect(axis.ticktext?.[0]).toBe("Clarity of …");
  });

  it("dedupes repeated values before building ticks", () => {
    const axis = truncateCategoryTicks(
      { type: "category" },
      ["A very long category name", "A very long category name", "B"],
      { compact: true },
    );
    expect(axis.tickvals).toHaveLength(2);
  });

  it("samples every Nth category when the count exceeds the tier's tick cap", () => {
    const many = Array.from(
      { length: 30 },
      (_, i) => `Category number ${String(i).padStart(2, "0")}`,
    );
    const axis = truncateCategoryTicks({ type: "category" }, many, { veryCompact: true });
    // veryCompact caps at 5 ticks: step ceil(30/5)=6 → 5 sampled values.
    expect(axis.tickvals).toHaveLength(5);
  });

  it("samples short labels purely on count when the tick cap is exceeded", () => {
    // Every label fits the 8-char veryCompact budget, so no truncation fires;
    // sampling must still run because 12 > the 5-tick cap.
    const many = Array.from({ length: 12 }, (_, i) => `c${String(i).padStart(2, "0")}`);
    const axis = truncateCategoryTicks({ type: "category" }, many, { veryCompact: true });
    expect(axis.tickmode).toBe("array");
    expect(axis.tickvals).toHaveLength(4); // step ceil(12/5)=3 → indices 0,3,6,9
    expect(axis.ticktext).toEqual(axis.tickvals); // short labels stay verbatim
  });

  it("samples in sorted order when categoryorder is category ascending", () => {
    const axis = truncateCategoryTicks(
      { type: "category", categoryorder: "category ascending" },
      ["Zebra crossing counts", "Apple orchard yields", "Mango tree heights"],
      { compact: true },
    );
    expect(axis.tickvals?.[0]).toBe("Apple orchard yields");
  });
});

describe("extendLayoutForFacets ultraCompactCells", () => {
  const cells = [
    { title: "A", xaxisId: "x", yaxisId: "y" },
    { title: "B", xaxisId: "x2", yaxisId: "y2" },
  ];
  const baseLayout = createBaseLayout({ xAxisTitle: "time", yAxisTitle: "value" });

  it("suppresses cell titles and shared/axis titles when on", () => {
    const out = extendLayoutForFacets(baseLayout, cells, {
      rows: 1,
      columns: 2,
      sharedXTitle: true,
      sharedYTitle: true,
      ultraCompactCells: true,
    });
    expect(out.annotations).toEqual([]);
    expect((out.xaxis as { title?: unknown }).title).toBeUndefined();
    expect((out.yaxis as { title?: unknown }).title).toBeUndefined();
  });

  it("keeps cell titles and shared titles when off", () => {
    const out = extendLayoutForFacets(baseLayout, cells, {
      rows: 1,
      columns: 2,
      sharedXTitle: true,
      sharedYTitle: true,
    });
    const texts = (out.annotations ?? []).map((a) => (a as { text?: string }).text);
    expect(texts).toContain("A");
    expect(texts).toContain("B");
    expect(texts).toContain("time");
    expect(texts).toContain("value");
  });
});
