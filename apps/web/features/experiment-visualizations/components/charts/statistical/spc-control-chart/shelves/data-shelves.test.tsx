import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { spcControlChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { spcControlChartDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: spcControlChartType.family,
        chartType: spcControlChartType.type,
        config: spcControlChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("spcControlChartDataShelves summaries", () => {
  const [x, y] = spcControlChartDataShelves;

  it("X falls back to INDEX when unset, returns the column when set", () => {
    expect(x.summary?.(form([]), t)).toBe("INDEX");
    expect(x.summary?.(form([{ tableName: "t", columnName: "timestamp", role: "x" }]), t)).toBe(
      "timestamp",
    );
  });

  it("Y returns the column when set, undefined otherwise", () => {
    expect(y.summary?.(form([]), t)).toBeUndefined();
    expect(y.summary?.(form([{ tableName: "t", columnName: "temperature", role: "y" }]), t)).toBe(
      "temperature",
    );
  });
});
