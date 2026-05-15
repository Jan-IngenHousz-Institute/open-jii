import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contourChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { contourDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: contourChartType.family,
        chartType: contourChartType.type,
        config: contourChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("contourDataShelves summaries", () => {
  const [x, y, z] = contourDataShelves;

  it.each([
    ["x", x],
    ["y", y],
    ["z", z],
  ] as const)("%s is undefined when unset, returns the column when set", (role, shelf) => {
    expect(shelf.summary?.(form([]), t)).toBeUndefined();
    expect(shelf.summary?.(form([{ tableName: "t", columnName: "col", role }]), t)).toBe("col");
  });
});
