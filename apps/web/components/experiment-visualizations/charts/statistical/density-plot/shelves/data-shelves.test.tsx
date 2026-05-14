import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { densityPlotChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { densityPlotDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: densityPlotChartType.family,
        chartType: densityPlotChartType.type,
        config: densityPlotChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("densityPlotDataShelves summaries", () => {
  const [variables, color, facet] = densityPlotDataShelves;

  it("variables is undefined / column / count summary", () => {
    expect(variables.summary?.(form([]), t)).toBeUndefined();
    expect(
      variables.summary?.(form([{ tableName: "t", columnName: "yield", role: "y" }]), t),
    ).toBe("yield");
    expect(
      variables.summary?.(
        form([
          { tableName: "t", columnName: "a", role: "y" },
          { tableName: "t", columnName: "b", role: "y" },
        ]),
        t,
      ),
    ).toBe("2 variables");
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
