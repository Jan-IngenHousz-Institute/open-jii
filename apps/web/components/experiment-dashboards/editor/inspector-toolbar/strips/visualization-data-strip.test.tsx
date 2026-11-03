import { createExperimentTable } from "@/test/factories";
import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { lineChartType } from "../../../../experiment-visualizations/charts/basic/line";
import type { ChartFormValues } from "../../../../experiment-visualizations/charts/chart-config";
import { DashboardEditorProvider } from "../../context/dashboard-editor-context";
import { VisualizationDataStrip } from "./visualization-data-strip";

const columns: ExperimentDataColumn[] = [
  { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function setup(
  selectedTableName: string,
  tableColumns: ExperimentDataColumn[],
  join?: ChartFormValues["dataConfig"]["join"],
) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DashboardEditorProvider>
        <VisualizationDataStrip
          form={form}
          experimentId="exp-1"
          tables={[createExperimentTable({ identifier: "leaf", displayName: "Leaf" })]}
          isTablesLoading={false}
          tablesError={null}
          selectedTableName={selectedTableName}
          onTableChange={vi.fn()}
          columns={tableColumns}
          isColumnsLoading={false}
          columnsError={null}
        />
      </DashboardEditorProvider>
    ),
    {
      useFormProps: {
        defaultValues: {
          name: "Chart",
          chartType: lineChartType.type,
          chartFamily: lineChartType.family,
          config: lineChartType.defaultConfig(),
          dataConfig: { tableName: selectedTableName, dataSources: [], join },
        },
      },
    },
  );
}

describe("VisualizationDataStrip second table control", () => {
  it.each(["", "leaf"])("hides the control until %s has columns", async (tableName) => {
    setup(tableName, []);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "editor.inspector.moreShelves" }));
    expect(screen.getByRole("button", { name: /editor.vizDataStrip.dataset/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /workspace.secondTable.title/ }),
    ).not.toBeInTheDocument();
  });

  it("includes the control after selecting a dataset with columns", async () => {
    setup("leaf", columns);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "editor.inspector.moreShelves" }));
    expect(screen.getByRole("button", { name: /workspace.secondTable.title/ })).toBeInTheDocument();
  });
  it("keeps an existing join editable when joined columns are loading or unavailable", async () => {
    setup("leaf", [], {
      tableName: "weather",
      matchColumn: "station",
      primaryTimeColumn: "time",
      secondaryTimeColumn: "time",
      toleranceMinutes: 5,
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "editor.inspector.moreShelves" }));
    expect(screen.getByRole("button", { name: /workspace.secondTable.title/ })).toBeInTheDocument();
  });
});
