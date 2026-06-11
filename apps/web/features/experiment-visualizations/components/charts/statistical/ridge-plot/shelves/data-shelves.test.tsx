import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ridgePlotChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { ridgePlotDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: ridgePlotChartType.family,
        chartType: ridgePlotChartType.type,
        config: ridgePlotChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("ridgePlotDataShelves summaries", () => {
  const [variable, color] = ridgePlotDataShelves;

  it("variable and color return their column when set, undefined otherwise", () => {
    const empty = form([]);
    expect(variable.summary?.(empty, t)).toBeUndefined();
    expect(color.summary?.(empty, t)).toBeUndefined();

    const populated = form([
      { tableName: "t", columnName: "yield", role: "y" },
      { tableName: "t", columnName: "site", role: "color" },
    ]);
    expect(variable.summary?.(populated, t)).toBe("yield");
    expect(color.summary?.(populated, t)).toBe("site");
  });
});
