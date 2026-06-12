import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { windRoseChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { windRoseDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: windRoseChartType.family,
        chartType: windRoseChartType.type,
        config: windRoseChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("windRoseDataShelves summaries", () => {
  const [direction, magnitude] = windRoseDataShelves;

  it.each([
    ["direction", direction, "x"],
    ["magnitude", magnitude, "y"],
  ] as const)("%s is undefined when unset, returns the column when set", (_label, shelf, role) => {
    expect(shelf.summary?.(form([]), t)).toBeUndefined();
    expect(shelf.summary?.(form([{ tableName: "t", columnName: "col", role }]), t)).toBe("col");
  });
});
