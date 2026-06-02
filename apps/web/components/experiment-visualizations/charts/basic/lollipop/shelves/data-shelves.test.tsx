import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lollipopChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { lollipopDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: lollipopChartType.family,
        chartType: lollipopChartType.type,
        config: lollipopChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("lollipopDataShelves summaries", () => {
  const [x, y] = lollipopDataShelves;

  it("X and Y return their column when set, undefined otherwise", () => {
    const empty = form([]);
    expect(x.summary?.(empty, t)).toBeUndefined();
    expect(y.summary?.(empty, t)).toBeUndefined();

    const populated = form([
      { tableName: "t", columnName: "variety", role: "x" },
      { tableName: "t", columnName: "yield", role: "y" },
    ]);
    expect(x.summary?.(populated, t)).toBe("variety");
    expect(y.summary?.(populated, t)).toBe("yield");
  });
});
