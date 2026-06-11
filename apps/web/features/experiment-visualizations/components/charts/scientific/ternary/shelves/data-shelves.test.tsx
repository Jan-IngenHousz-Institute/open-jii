import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ternaryChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { ternaryDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: ternaryChartType.family,
        chartType: ternaryChartType.type,
        config: ternaryChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("ternaryDataShelves summaries", () => {
  const [a, b, c, color] = ternaryDataShelves;

  it.each([
    ["a", a, "x"],
    ["b", b, "y"],
    ["c", c, "z"],
    ["color", color, "color"],
  ] as const)("%s is undefined when unset, returns the column when set", (_label, shelf, role) => {
    expect(shelf.summary?.(form([]), t)).toBeUndefined();
    expect(shelf.summary?.(form([{ tableName: "t", columnName: "col", role }]), t)).toBe("col");
  });
});
