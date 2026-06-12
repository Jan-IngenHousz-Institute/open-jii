import { renderWithForm } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { bubbleChartType } from "..";
import type { ChartFormValues } from "../../../chart-config";
import type { ShelfSummaryT } from "../../../types";
import { bubbleDataShelves } from "./data-shelves";

const t: ShelfSummaryT = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key);

function form(dataSources: ChartFormValues["dataConfig"]["dataSources"]) {
  return renderWithForm<ChartFormValues>(() => <div />, {
    useFormProps: {
      defaultValues: {
        name: "",
        description: "",
        chartFamily: bubbleChartType.family,
        chartType: bubbleChartType.type,
        config: bubbleChartType.defaultConfig(),
        dataConfig: { tableName: "t", dataSources },
      },
    },
  }).form;
}

describe("bubbleDataShelves summaries", () => {
  const [x, y, size, color, facet] = bubbleDataShelves;

  it("each shelf returns its column when set, undefined otherwise", () => {
    const empty = form([]);
    expect(x.summary?.(empty, t)).toBeUndefined();
    expect(y.summary?.(empty, t)).toBeUndefined();
    expect(size.summary?.(empty, t)).toBeUndefined();
    expect(color.summary?.(empty, t)).toBeUndefined();
    expect(facet.summary?.(empty, t)).toBeUndefined();

    const populated = form([
      { tableName: "t", columnName: "x_col", role: "x" },
      { tableName: "t", columnName: "y_col", role: "y" },
      { tableName: "t", columnName: "size_col", role: "size" },
      { tableName: "t", columnName: "color_col", role: "color" },
      { tableName: "t", columnName: "facet_col", role: "facet" },
    ]);
    expect(x.summary?.(populated, t)).toBe("x_col");
    expect(y.summary?.(populated, t)).toBe("y_col");
    expect(size.summary?.(populated, t)).toBe("size_col");
    expect(color.summary?.(populated, t)).toBe("color_col");
    expect(facet.summary?.(populated, t)).toBe("facet_col");
  });
});
