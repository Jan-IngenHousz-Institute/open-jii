import { describe, expect, it } from "vitest";

import {
  zCreateExperimentDashboardBody,
  zExperimentDashboard,
  zExperimentDashboardLayout,
  zExperimentDashboardList,
  zExperimentDashboardPathParam,
  zExperimentDashboardWidget,
  zExperimentFilterWidget,
  zExperimentRichTextWidget,
  zExperimentTableWidget,
  zExperimentVisualizationWidget,
  zExperimentWidgetLayout,
  zListExperimentDashboardsQuery,
  zUpdateExperimentDashboardBody,
} from "./experiment-dashboards.schema";

const uuidA = "11111111-1111-1111-1111-111111111111";
const uuidB = "22222222-2222-2222-2222-222222222222";
const uuidC = "33333333-3333-3333-3333-333333333333";
const isoTime = "2024-01-15T10:00:00Z";
const isoTime2 = "2024-01-15T11:00:00Z";

describe("Dashboard schemas", () => {
  const layout = { col: 0, row: 0, colSpan: 6, rowSpan: 4 };

  describe("zExperimentWidgetLayout", () => {
    it("accepts a valid layout block", () => {
      expect(zExperimentWidgetLayout.parse(layout)).toEqual(layout);
    });

    it("rejects negative coordinates", () => {
      expect(zExperimentWidgetLayout.safeParse({ ...layout, col: -1 }).success).toBe(false);
    });

    it("rejects zero spans (min is 1)", () => {
      expect(zExperimentWidgetLayout.safeParse({ ...layout, colSpan: 0 }).success).toBe(false);
      expect(zExperimentWidgetLayout.safeParse({ ...layout, rowSpan: 0 }).success).toBe(false);
    });

    it("caps colSpan at 24 and rowSpan at 48", () => {
      expect(zExperimentWidgetLayout.safeParse({ ...layout, colSpan: 25 }).success).toBe(false);
      expect(zExperimentWidgetLayout.safeParse({ ...layout, rowSpan: 49 }).success).toBe(false);
    });
  });

  describe("zExperimentVisualizationWidget", () => {
    it("applies default showTitle=true, showDescription=false", () => {
      const w = {
        id: uuidA,
        layout,
        type: "visualization" as const,
        config: { visualizationId: uuidB },
      };
      const parsed = zExperimentVisualizationWidget.parse(w);
      expect(parsed.config.showTitle).toBe(true);
      expect(parsed.config.showDescription).toBe(false);
    });

    it("allows visualizationId to be omitted (draft state)", () => {
      const w = { id: uuidA, layout, type: "visualization" as const, config: {} };
      expect(zExperimentVisualizationWidget.parse(w).config.visualizationId).toBeUndefined();
    });
  });

  describe("zExperimentRichTextWidget", () => {
    it("defaults html to empty string when omitted", () => {
      const w = { id: uuidA, layout, type: "richText" as const, config: {} };
      expect(zExperimentRichTextWidget.parse(w).config.html).toBe("");
    });
  });

  describe("zExperimentTableWidget", () => {
    it("defaults pageSize to 25", () => {
      const w = { id: uuidA, layout, type: "table" as const, config: {} };
      expect(zExperimentTableWidget.parse(w).config.pageSize).toBe(25);
    });

    it("rejects unsupported pageSize values", () => {
      const w = {
        id: uuidA,
        layout,
        type: "table" as const,
        config: { pageSize: 30 },
      };
      expect(zExperimentTableWidget.safeParse(w).success).toBe(false);
    });

    it("rejects empty column names in the projection list", () => {
      const w = {
        id: uuidA,
        layout,
        type: "table" as const,
        config: { columns: [""] },
      };
      expect(zExperimentTableWidget.safeParse(w).success).toBe(false);
    });

    it("propagates zExperimentDataFilter refinements to per-widget filters", () => {
      const w = {
        id: uuidA,
        layout,
        type: "table" as const,
        config: { filters: [{ column: "x", operator: "between", value: [1] }] },
      };
      expect(zExperimentTableWidget.safeParse(w).success).toBe(false);
    });
  });

  describe("zExperimentFilterWidget", () => {
    it("allows all selection fields to be unset (draft state)", () => {
      const w = { id: uuidA, layout, type: "filter" as const, config: {} };
      const parsed = zExperimentFilterWidget.parse(w);
      expect(parsed.config.column).toBeUndefined();
      expect(parsed.config.operator).toBeUndefined();
    });

    it("accepts a fully configured filter card", () => {
      const w = {
        id: uuidA,
        layout,
        type: "filter" as const,
        config: {
          tableName: "readings",
          column: "tag",
          operator: "in" as const,
          defaultValue: ["a", "b"],
        },
      };
      expect(zExperimentFilterWidget.parse(w)).toBeDefined();
    });
  });

  describe("zExperimentDashboardWidget (discriminated union)", () => {
    it("dispatches on `type`", () => {
      const viz = {
        id: uuidA,
        layout,
        type: "visualization" as const,
        config: { visualizationId: uuidB },
      };
      const text = {
        id: uuidB,
        layout,
        type: "richText" as const,
        config: { html: "<p>hi</p>" },
      };
      expect(zExperimentDashboardWidget.parse(viz).type).toBe("visualization");
      expect(zExperimentDashboardWidget.parse(text).type).toBe("richText");
    });

    it("rejects unknown discriminator values", () => {
      const bad = { id: uuidA, layout, type: "iframe", config: {} };
      expect(zExperimentDashboardWidget.safeParse(bad).success).toBe(false);
    });
  });

  describe("zExperimentDashboardLayout", () => {
    it("applies grid defaults when fields omitted", () => {
      const parsed = zExperimentDashboardLayout.parse({});
      expect(parsed.columns).toBe(12);
      expect(parsed.rowHeight).toBe(80);
      expect(parsed.gap).toBe(16);
    });

    it("rejects out-of-range values", () => {
      expect(zExperimentDashboardLayout.safeParse({ columns: 0 }).success).toBe(false);
      expect(zExperimentDashboardLayout.safeParse({ rowHeight: 500 }).success).toBe(false);
      expect(zExperimentDashboardLayout.safeParse({ gap: 100 }).success).toBe(false);
    });
  });

  describe("zExperimentDashboard", () => {
    const dashboard = {
      id: uuidA,
      experimentId: uuidB,
      name: "My Dashboard",
      description: null,
      layout: { columns: 12, rowHeight: 80, gap: 16 },
      widgets: [],
      createdBy: uuidC,
      createdAt: isoTime,
      updatedAt: isoTime2,
    };

    it("accepts a complete dashboard with empty widgets list", () => {
      expect(zExperimentDashboard.parse(dashboard)).toEqual(dashboard);
    });

    it("accepts a dashboard with widgets of every type", () => {
      const widgets = [
        { id: uuidA, layout, type: "visualization", config: {} },
        { id: uuidB, layout, type: "richText", config: { html: "" } },
        { id: uuidC, layout, type: "table", config: { pageSize: 25 } },
        {
          id: "44444444-4444-4444-4444-444444444444",
          layout,
          type: "filter",
          config: {},
        },
      ];
      const full = { ...dashboard, widgets };
      const parsed = zExperimentDashboard.parse(full);
      expect(parsed.widgets).toHaveLength(4);
    });

    it("rejects an empty name", () => {
      expect(zExperimentDashboard.safeParse({ ...dashboard, name: "" }).success).toBe(false);
    });

    it("rejects a non-UUID experimentId", () => {
      expect(zExperimentDashboard.safeParse({ ...dashboard, experimentId: "nope" }).success).toBe(
        false,
      );
    });

    it("zExperimentDashboardList accepts arrays", () => {
      expect(zExperimentDashboardList.parse([dashboard, dashboard])).toHaveLength(2);
    });
  });

  describe("zCreateExperimentDashboardBody / zUpdateExperimentDashboardBody", () => {
    it("create body requires only name", () => {
      expect(zCreateExperimentDashboardBody.parse({ name: "X" })).toEqual({ name: "X" });
    });

    it("create body rejects empty name", () => {
      expect(zCreateExperimentDashboardBody.safeParse({ name: "" }).success).toBe(false);
    });

    it("create body accepts a partial layout", () => {
      const parsed = zCreateExperimentDashboardBody.parse({
        name: "X",
        layout: { columns: 16 },
      });
      expect(parsed.layout).toEqual({ columns: 16 });
    });

    it("update body makes every field optional including name", () => {
      expect(zUpdateExperimentDashboardBody.parse({})).toEqual({});
      expect(zUpdateExperimentDashboardBody.parse({ description: "new" })).toEqual({
        description: "new",
      });
    });
  });

  describe("zListExperimentDashboardsQuery", () => {
    it("applies default limit and offset", () => {
      const parsed = zListExperimentDashboardsQuery.parse({});
      expect(parsed.limit).toBe(50);
      expect(parsed.offset).toBe(0);
    });

    it("coerces stringified limit and offset", () => {
      const parsed = zListExperimentDashboardsQuery.parse({ limit: "10", offset: "20" });
      expect(parsed.limit).toBe(10);
      expect(parsed.offset).toBe(20);
    });

    it("rejects a limit above 100", () => {
      expect(zListExperimentDashboardsQuery.safeParse({ limit: "101" }).success).toBe(false);
    });
  });

  describe("zExperimentDashboardPathParam", () => {
    it("accepts valid UUIDs and rejects non-UUIDs", () => {
      const ok = { id: uuidA, dashboardId: uuidB };
      expect(zExperimentDashboardPathParam.parse(ok)).toEqual(ok);
      expect(
        zExperimentDashboardPathParam.safeParse({ id: uuidA, dashboardId: "nope" }).success,
      ).toBe(false);
    });
  });
});
