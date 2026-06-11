import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { histogram2DChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { histogram2DDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: histogram2DChartType.family,
        chartType: histogram2DChartType.type,
        config: histogram2DChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("histogram2DDataShelves summaries", () => {
  const [x, y] = histogram2DDataShelves;

  it("X and Y return their column when set, undefined otherwise", () => {
    const empty = form([]);
    expect(x.summary?.(empty, t)).toBeUndefined();
    expect(y.summary?.(empty, t)).toBeUndefined();

    const populated = form([
      { tableName: "t", columnName: "x_col", role: "x" },
      { tableName: "t", columnName: "y_col", role: "y" },
    ]);
    expect(x.summary?.(populated, t)).toBe("x_col");
    expect(y.summary?.(populated, t)).toBe("y_col");
  });
});
