import { BarChart3, Filter, Table2, Type } from "lucide-react";
import { describe, expect, it } from "vitest";

import { widgetMetaFor, widgetMetaForTool, widgetTypeForTool } from "./widget-meta";

describe("widgetMetaFor", () => {
  it("returns the chart icon and i18n key for visualization widgets", () => {
    expect(widgetMetaFor("visualization")).toEqual({
      icon: BarChart3,
      labelKey: "editor.widgetTypes.visualization",
    });
  });

  it("returns the table icon for table widgets", () => {
    expect(widgetMetaFor("table").icon).toBe(Table2);
  });

  it("returns the filter icon for filter widgets", () => {
    expect(widgetMetaFor("filter").icon).toBe(Filter);
  });

  it("returns the type icon for rich-text widgets", () => {
    expect(widgetMetaFor("richText").icon).toBe(Type);
  });
});

describe("widgetTypeForTool", () => {
  it("maps the chart tool to the visualization widget type", () => {
    expect(widgetTypeForTool("chart")).toBe("visualization");
  });

  it("maps the text tool to the richText widget type", () => {
    expect(widgetTypeForTool("text")).toBe("richText");
  });

  it("maps the table tool to the table widget type", () => {
    expect(widgetTypeForTool("table")).toBe("table");
  });

  it("maps the filter tool to the filter widget type", () => {
    expect(widgetTypeForTool("filter")).toBe("filter");
  });
});

describe("widgetMetaForTool", () => {
  it("composes tool-to-type with meta lookup", () => {
    expect(widgetMetaForTool("chart")).toEqual(widgetMetaFor("visualization"));
    expect(widgetMetaForTool("text")).toEqual(widgetMetaFor("richText"));
  });
});
