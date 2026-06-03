import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { correlationMatrixChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { correlationMatrixDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: correlationMatrixChartType.family,
        chartType: correlationMatrixChartType.type,
        config: correlationMatrixChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("correlationMatrixDataShelves summaries", () => {
  const [variables] = correlationMatrixDataShelves;

  it("is undefined / column / pluralized count of UNIQUE columns", () => {
    expect(variables.summary?.(form([]), t)).toBeUndefined();
    expect(variables.summary?.(form([{ tableName: "t", columnName: "a", role: "y" }]), t)).toBe(
      "a",
    );
    expect(
      variables.summary?.(
        form([
          { tableName: "t", columnName: "a", role: "y" },
          { tableName: "t", columnName: "b", role: "y" },
          { tableName: "t", columnName: "b", role: "y" },
        ]),
        t,
      ),
    ).toBe(`workspace.shelves.variablesCount:{"count":2}`);
  });
});
