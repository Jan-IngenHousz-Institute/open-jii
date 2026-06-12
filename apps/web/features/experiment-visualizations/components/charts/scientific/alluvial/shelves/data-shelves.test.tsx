import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { alluvialChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { alluvialDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: alluvialChartType.family,
        chartType: alluvialChartType.type,
        config: alluvialChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("alluvialDataShelves summaries", () => {
  const [stages, value] = alluvialDataShelves;

  it("stages is undefined / column / pluralized count", () => {
    expect(stages.summary?.(form([]), t)).toBeUndefined();
    expect(
      stages.summary?.(form([{ tableName: "t", columnName: "phase", role: "groupBy" }]), t),
    ).toBe("phase");
    expect(
      stages.summary?.(
        form([
          { tableName: "t", columnName: "p1", role: "groupBy" },
          { tableName: "t", columnName: "p2", role: "groupBy" },
          { tableName: "t", columnName: "p3", role: "groupBy" },
        ]),
        t,
      ),
    ).toBe(`workspace.shelves.stagesCount:{"count":3}`);
  });

  it("value returns the column when set, undefined otherwise", () => {
    expect(value.summary?.(form([]), t)).toBeUndefined();
    expect(
      value.summary?.(form([{ tableName: "t", columnName: "amount", role: "value" }]), t),
    ).toBe("amount");
  });
});
