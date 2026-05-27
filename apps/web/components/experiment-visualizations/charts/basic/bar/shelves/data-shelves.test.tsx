import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { barChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { barDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: barChartType.family,
        chartType: barChartType.type,
        config: barChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("barDataShelves summaries", () => {
  const [x, y, group, facet] = barDataShelves;

  it("X falls back to INDEX when unset, returns the column when set", () => {
    expect(x.summary?.(form([]), t)).toBe("INDEX");
    expect(x.summary?.(form([{ tableName: "t", columnName: "variety", role: "x" }]), t)).toBe(
      "variety",
    );
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

  it("groupBy + facet return the column when set, undefined otherwise", () => {
    expect(group.summary?.(form([]), t)).toBeUndefined();
    expect(facet.summary?.(form([]), t)).toBeUndefined();
    expect(group.summary?.(form([{ tableName: "t", columnName: "site", role: "color" }]), t)).toBe(
      "site",
    );
    expect(
      facet.summary?.(form([{ tableName: "t", columnName: "season", role: "facet" }]), t),
    ).toBe("season");
  });
});
