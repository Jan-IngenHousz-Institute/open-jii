import { createExperimentDataTable, createFilterWidget } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useFilterWidgetConfig } from "./use-filter-widget-config";

function mountColumns(tableName: string) {
  server.mount(contract.experiments.getExperimentData, {
    body: [
      createExperimentDataTable({
        name: tableName,
        data: {
          columns: [
            { name: "device_id", type_name: "STRING", type_text: "STRING" },
            { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
          ],
          rows: [],
          totalRows: 0,
          truncated: false,
        },
      }),
    ],
  });
}

describe("useFilterWidgetConfig", () => {
  it("returns isConfigured=false when the widget is in its draft state", () => {
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: true,
        tableName: undefined,
        column: undefined,
        operator: undefined,
      },
    });
    const { result } = renderHook(() => useFilterWidgetConfig(widget, "exp-1"));
    expect(result.current.isConfigured).toBe(false);
    expect(result.current.operator).toBeUndefined();
  });

  it("flags isConfigured once tableName, column, and operator are present", () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: true,
        tableName: "raw_data",
        column: "value",
        operator: "equals",
      },
    });
    const { result } = renderHook(() => useFilterWidgetConfig(widget, "exp-1"));
    expect(result.current.isConfigured).toBe(true);
    expect(result.current.tableName).toBe("raw_data");
  });

  it("resolves the column from metadata using the parent name of a struct path", async () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: true,
        tableName: "raw_data",
        column: "value.nested",
        operator: "equals",
      },
    });
    const { result } = renderHook(() => useFilterWidgetConfig(widget, "exp-1"));

    await waitFor(() => expect(result.current.column?.name).toBe("value"));
    expect(result.current.parentColumn).toBe("value");
  });

  it("looks up the operator label from the kind-aware operator set", async () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: true,
        tableName: "raw_data",
        column: "device_id",
        operator: "equals",
      },
    });
    const { result } = renderHook(() => useFilterWidgetConfig(widget, "exp-1"));
    // STRING column - categorical operators - "equals" label is "is".
    await waitFor(() => expect(result.current.operatorLabel).toBe("is"));
  });

  it("falls back to parentColumn for displayTitle when no title is configured", () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: true,
        tableName: "raw_data",
        column: "value",
        operator: "equals",
      },
    });
    const { result } = renderHook(() => useFilterWidgetConfig(widget, "exp-1"));
    expect(result.current.displayTitle).toBe("value");
  });

  it("uses the explicit title when configured", () => {
    mountColumns("raw_data");
    const widget = createFilterWidget({
      config: {
        showTitle: true,
        showDescription: true,
        tableName: "raw_data",
        column: "value",
        operator: "equals",
        title: "My Filter",
      },
    });
    const { result } = renderHook(() => useFilterWidgetConfig(widget, "exp-1"));
    expect(result.current.displayTitle).toBe("My Filter");
  });
});
