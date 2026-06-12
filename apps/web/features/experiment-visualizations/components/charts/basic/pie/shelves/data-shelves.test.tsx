import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { pieChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { pieDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: pieChartType.family,
        chartType: pieChartType.type,
        config: pieChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("pieDataShelves summaries", () => {
  const [labels, values] = pieDataShelves;

  it("labels and values return their column when set, undefined otherwise", () => {
    const empty = form([]);
    expect(labels.summary?.(empty, t)).toBeUndefined();
    expect(values.summary?.(empty, t)).toBeUndefined();

    const populated = form([
      { tableName: "t", columnName: "category", role: "labels" },
      { tableName: "t", columnName: "amount", role: "values" },
    ]);
    expect(labels.summary?.(populated, t)).toBe("category");
    expect(values.summary?.(populated, t)).toBe("amount");
  });
});
