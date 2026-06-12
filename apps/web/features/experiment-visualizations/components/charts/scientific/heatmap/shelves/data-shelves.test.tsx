import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { heatmapChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { heatmapDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: heatmapChartType.family,
        chartType: heatmapChartType.type,
        config: heatmapChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("heatmapDataShelves summaries", () => {
  const [x, y, z] = heatmapDataShelves;

  it.each([
    ["x", x],
    ["y", y],
    ["z", z],
  ] as const)("%s is undefined when unset, returns the column when set", (role, shelf) => {
    expect(shelf.summary?.(form([]), t)).toBeUndefined();
    expect(shelf.summary?.(form([{ tableName: "t", columnName: "col", role }]), t)).toBe("col");
  });
});
