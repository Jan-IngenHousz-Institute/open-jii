import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { radarChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { radarDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: radarChartType.family,
        chartType: radarChartType.type,
        config: radarChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("radarDataShelves summaries", () => {
  const [axes, color] = radarDataShelves;

  it("axes is undefined / column / pluralized axes count", () => {
    expect(axes.summary?.(form([]), t)).toBeUndefined();
    expect(axes.summary?.(form([{ tableName: "t", columnName: "a", role: "y" }]), t)).toBe("a");
    expect(
      axes.summary?.(
        form([
          { tableName: "t", columnName: "a", role: "y" },
          { tableName: "t", columnName: "b", role: "y" },
          { tableName: "t", columnName: "c", role: "y" },
        ]),
        t,
      ),
    ).toBe(`workspace.shelves.axesCount:{"count":3}`);
  });

  it("color returns the column when set, undefined otherwise", () => {
    expect(color.summary?.(form([]), t)).toBeUndefined();
    expect(color.summary?.(form([{ tableName: "t", columnName: "hue", role: "color" }]), t)).toBe(
      "hue",
    );
  });
});
