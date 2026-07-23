import { describe, expect, it } from "vitest";

import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import {
  compactWidgets,
  compactWithGhost,
  defaultWidgetSize,
  PLACEMENT_GHOST_ID,
  widgetForTool,
  widgetToLayoutItem,
  widgetTypeForTool,
} from "./dashboard-grid-helpers";

function richText(
  id: string,
  layout: ExperimentDashboardWidget["layout"],
): ExperimentDashboardWidget {
  return { id, type: "richText", layout, config: { html: "" } };
}

describe("widgetTypeForTool", () => {
  it("returns null for the cursor tool", () => {
    expect(widgetTypeForTool("cursor")).toBeNull();
  });

  it("maps placement tools to their widget types", () => {
    expect(widgetTypeForTool("chart")).toBe("visualization");
    expect(widgetTypeForTool("text")).toBe("richText");
    expect(widgetTypeForTool("table")).toBe("table");
    expect(widgetTypeForTool("filter")).toBe("filter");
  });
});

describe("defaultWidgetSize", () => {
  it("clamps colSpan to the available columns", () => {
    const { colSpan, rowSpan } = defaultWidgetSize("visualization", 4);
    expect(colSpan).toBeLessThanOrEqual(4);
    expect(rowSpan).toBeGreaterThan(0);
  });

  it("uses the filter widget's preferred default size", () => {
    const { colSpan, rowSpan } = defaultWidgetSize("filter", 12);
    expect(colSpan).toBe(3);
    expect(rowSpan).toBe(2);
  });

  it("falls back to a minimum colSpan of 1 when columns is zero", () => {
    const { colSpan } = defaultWidgetSize("table", 0);
    expect(colSpan).toBeGreaterThanOrEqual(1);
  });
});

describe("widgetForTool", () => {
  it("returns null for the cursor tool", () => {
    expect(widgetForTool("cursor", 12, 0, 0)).toBeNull();
  });

  it("produces a visualization widget with a fresh id and clamped position", () => {
    const w = widgetForTool("chart", 12, 100, 5);
    expect(w).not.toBeNull();
    if (!w) return;
    expect(w.type).toBe("visualization");
    expect(typeof w.id).toBe("string");
    expect(w.id.length).toBeGreaterThan(0);
    expect(w.layout.col + w.layout.colSpan).toBeLessThanOrEqual(12);
    expect(w.layout.row).toBe(5);
  });

  it("emits the type-appropriate default config for each placement tool", () => {
    const chart = widgetForTool("chart", 12, 0, 0);
    const text = widgetForTool("text", 12, 0, 0);
    const table = widgetForTool("table", 12, 0, 0);
    const filter = widgetForTool("filter", 12, 0, 0);
    expect(chart?.type).toBe("visualization");
    expect(text?.type).toBe("richText");
    expect(table?.type).toBe("table");
    expect(filter?.type).toBe("filter");
    if (text?.type === "richText") expect(text.config.html).toBe("");
    if (table?.type === "table") expect(table.config.pageSize).toBe(25);
  });

  it("rejects negative rows by clamping to 0", () => {
    const w = widgetForTool("chart", 12, 0, -5);
    expect(w?.layout.row).toBe(0);
  });
});

describe("widgetToLayoutItem", () => {
  it("maps a widget's layout into RGL's LayoutItem shape", () => {
    const widget: ExperimentDashboardWidget = {
      id: "w1",
      type: "richText",
      layout: { col: 2, row: 3, colSpan: 4, rowSpan: 5 },
      config: { html: "" },
    };
    const item = widgetToLayoutItem(widget);
    expect(item).toMatchObject({ i: "w1", x: 2, y: 3, w: 4, h: 5 });
    expect(item.minW).toBeGreaterThan(0);
    expect(item.minH).toBeGreaterThan(0);
  });
});

describe("compactWithGhost", () => {
  it("inserts the ghost as a static layout item alongside real ones", () => {
    const items = [{ i: "a", x: 0, y: 0, w: 4, h: 2 }];
    const ghost = { i: PLACEMENT_GHOST_ID, x: 4, y: 0, w: 4, h: 2, static: true };
    const compacted = compactWithGhost(items, ghost, 12);
    expect(compacted.some((c) => c.i === PLACEMENT_GHOST_ID)).toBe(true);
    expect(compacted.some((c) => c.i === "a")).toBe(true);
  });
});

describe("compactWidgets", () => {
  it("closes the row gap left by a deleted widget so the lower one shifts up", () => {
    // Caller has already removed widget "deleted"; the remaining "below"
    // started at row 6, leaving a 6-row gap that the compactor must close.
    const remaining = [richText("below", { col: 0, row: 6, colSpan: 6, rowSpan: 4 })];
    const result = compactWidgets(remaining, 12);
    expect(result[0].layout.row).toBe(0);
  });

  it("returns the same widget references when nothing needs to move", () => {
    const a = richText("a", { col: 0, row: 0, colSpan: 6, rowSpan: 4 });
    const b = richText("b", { col: 6, row: 0, colSpan: 6, rowSpan: 4 });
    const result = compactWidgets([a, b], 12);
    // Untouched widgets keep their identity so widget config / refs stay stable.
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });

  it("preserves widget config / fields that aren't part of layout", () => {
    const widget: ExperimentDashboardWidget = {
      id: "w1",
      type: "richText",
      layout: { col: 0, row: 5, colSpan: 6, rowSpan: 4 },
      config: { html: "<p>hello</p>" },
    };
    const [result] = compactWidgets([widget], 12);
    expect(result.id).toBe("w1");
    expect(result.config).toEqual({ html: "<p>hello</p>" });
    expect(result.layout.row).toBe(0);
  });
});
