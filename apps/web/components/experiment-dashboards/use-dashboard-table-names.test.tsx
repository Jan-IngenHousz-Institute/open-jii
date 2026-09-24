import {
  createFilterWidget,
  createRichTextWidget,
  createTableWidget,
  createVisualization,
  createVisualizationWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useDashboardTableNames } from "./use-dashboard-table-names";

function tableWidget(tableName: string) {
  return createTableWidget({
    config: { tableName, pageSize: 25, showTitle: true, showDescription: true },
  });
}

describe("useDashboardTableNames", () => {
  it("names each table the dashboard's charts and tables read, once", async () => {
    const chart = createVisualization({
      dataConfig: { tableName: "macro-1", dataSources: [] },
    });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [chart] });
    const widgets = [
      createVisualizationWidget({
        config: { visualizationId: chart.id, showTitle: true, showDescription: false },
      }),
      tableWidget("raw_data"),
      tableWidget("macro-1"),
      createFilterWidget({ config: { tableName: "upload-1" } }),
      createRichTextWidget(),
    ];

    const { result } = renderHook(() => useDashboardTableNames("exp-1", widgets));

    await waitFor(() => expect(result.current).toEqual(["macro-1", "raw_data"]));
  });

  it("names nothing while no widget reads a table", () => {
    server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

    const { result } = renderHook(() =>
      useDashboardTableNames("exp-1", [createRichTextWidget(), createVisualizationWidget()]),
    );

    expect(result.current).toBeUndefined();
  });
});
