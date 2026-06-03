import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { boxPlotChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { boxPlotDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: boxPlotChartType.family,
        chartType: boxPlotChartType.type,
        config: boxPlotChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("boxPlotDataShelves summaries", () => {
  const [x, y, color, facet] = boxPlotDataShelves;

  it("X falls back to INDEX when unset, returns the column when set", () => {
    expect(x.summary?.(form([]), t)).toBe("INDEX");
    expect(x.summary?.(form([{ tableName: "t", columnName: "site", role: "x" }]), t)).toBe("site");
  });

  it("Y is undefined / column / count by series count", () => {
    expect(y.summary?.(form([]), t)).toBeUndefined();
    expect(y.summary?.(form([{ tableName: "t", columnName: "yield", role: "y" }]), t)).toBe(
      "yield",
    );
    expect(
      y.summary?.(
        form([
          { tableName: "t", columnName: "a", role: "y" },
          { tableName: "t", columnName: "b", role: "y" },
        ]),
        t,
      ),
    ).toBe(`workspace.shelves.seriesCount:{"count":2}`);
  });

  it("color + facet return the column when set, undefined otherwise", () => {
    expect(color.summary?.(form([]), t)).toBeUndefined();
    expect(facet.summary?.(form([]), t)).toBeUndefined();
    expect(color.summary?.(form([{ tableName: "t", columnName: "dev", role: "color" }]), t)).toBe(
      "dev",
    );
    expect(facet.summary?.(form([{ tableName: "t", columnName: "site", role: "facet" }]), t)).toBe(
      "site",
    );
  });
});
