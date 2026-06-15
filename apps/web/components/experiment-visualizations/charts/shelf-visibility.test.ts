import { renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { ChartFormValues } from "./chart-config";
import { hasAnyErrorColumn, hasFacetSource, hasTraceType } from "./shelf-visibility";

function makeForm(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderHook(() =>
    useForm<ChartFormValues>({
      defaultValues: {
        name: "Untitled",
        description: "",
        chartFamily: "basic",
        chartType: "line",
        config: {},
        dataConfig: { tableName: "harvest", dataSources },
      },
    }),
  ).result.current;
}

describe("shelf-visibility predicates", () => {
  describe("hasAnyErrorColumn", () => {
    it("returns false when no source has an errorColumn", () => {
      const form = makeForm([
        { tableName: "harvest", columnName: "variety", role: "x" },
        { tableName: "harvest", columnName: "yield", role: "y" },
      ]);
      expect(hasAnyErrorColumn(form)).toBe(false);
    });

    it("returns false when errorColumn is an empty string (treated as unset)", () => {
      const form = makeForm([
        { tableName: "harvest", columnName: "yield", role: "y", errorColumn: "" },
      ]);
      expect(hasAnyErrorColumn(form)).toBe(false);
    });

    it("returns true when at least one source has a non-empty errorColumn", () => {
      const form = makeForm([
        { tableName: "harvest", columnName: "yield", role: "y", errorColumn: "yield_se" },
      ]);
      expect(hasAnyErrorColumn(form)).toBe(true);
    });
  });

  describe("hasFacetSource", () => {
    it("returns false when no source has role=facet", () => {
      const form = makeForm([{ tableName: "harvest", columnName: "yield", role: "y" }]);
      expect(hasFacetSource(form)).toBe(false);
    });

    it("returns false when a facet source has no columnName picked yet", () => {
      const form = makeForm([
        { tableName: "harvest", columnName: "yield", role: "y" },
        { tableName: "harvest", columnName: "", role: "facet" },
      ]);
      expect(hasFacetSource(form)).toBe(false);
    });

    it("returns true when a facet source has a column picked", () => {
      const form = makeForm([
        { tableName: "harvest", columnName: "yield", role: "y" },
        { tableName: "harvest", columnName: "season", role: "facet" },
      ]);
      expect(hasFacetSource(form)).toBe(true);
    });
  });

  describe("hasTraceType", () => {
    it("only inspects sources with role=y", () => {
      const form = makeForm([
        // x source with traceType=line should be ignored.
        { tableName: "harvest", columnName: "variety", role: "x", traceType: "line" },
        { tableName: "harvest", columnName: "yield", role: "y", traceType: "bar" },
      ]);
      expect(hasTraceType(form, "line")).toBe(false);
      expect(hasTraceType(form, "bar")).toBe(true);
    });
  });
});
