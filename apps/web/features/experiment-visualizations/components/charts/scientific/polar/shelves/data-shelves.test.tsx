import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { polarChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { polarDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: polarChartType.family,
        chartType: polarChartType.type,
        config: polarChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("polarDataShelves summaries", () => {
  const [theta, radial, color] = polarDataShelves;

  it("theta is undefined when unset, returns the column when set", () => {
    expect(theta.summary?.(form([]), t)).toBeUndefined();
    expect(theta.summary?.(form([{ tableName: "t", columnName: "bearing", role: "x" }]), t)).toBe(
      "bearing",
    );
  });

  it("radial is undefined / column / pluralized series count", () => {
    expect(radial.summary?.(form([]), t)).toBeUndefined();
    expect(radial.summary?.(form([{ tableName: "t", columnName: "r", role: "y" }]), t)).toBe("r");
    expect(
      radial.summary?.(
        form([
          { tableName: "t", columnName: "r1", role: "y" },
          { tableName: "t", columnName: "r2", role: "y" },
        ]),
        t,
      ),
    ).toBe(`workspace.shelves.seriesCount:{"count":2}`);
  });

  it("color returns the column when set, undefined otherwise", () => {
    expect(color.summary?.(form([]), t)).toBeUndefined();
    expect(color.summary?.(form([{ tableName: "t", columnName: "hue", role: "color" }]), t)).toBe(
      "hue",
    );
  });
});
