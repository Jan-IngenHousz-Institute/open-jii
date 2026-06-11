import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { areaChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { areaDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: areaChartType.family,
        chartType: areaChartType.type,
        config: areaChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("areaDataShelves summaries", () => {
  const [x, y, group, facet] = areaDataShelves;

  it("X falls back to INDEX when unset, returns the column when set", () => {
    expect(x.summary?.(form([]), t)).toBe("INDEX");
    expect(x.summary?.(form([{ tableName: "t", columnName: "time", role: "x" }]), t)).toBe("time");
  });

  it("Y is undefined / column / count by series count", () => {
    expect(y.summary?.(form([]), t)).toBeUndefined();
    expect(y.summary?.(form([{ tableName: "t", columnName: "load", role: "y" }]), t)).toBe("load");
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
    expect(group.summary?.(form([{ tableName: "t", columnName: "dev", role: "color" }]), t)).toBe(
      "dev",
    );
    expect(facet.summary?.(form([{ tableName: "t", columnName: "site", role: "facet" }]), t)).toBe(
      "site",
    );
  });
});
