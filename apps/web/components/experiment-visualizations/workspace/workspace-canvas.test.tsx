import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { lineChartType } from "../charts/basic/line";
import type { ChartFormValues } from "../charts/chart-config";
import { WorkspaceCanvas } from "./workspace-canvas";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
    ...overrides,
  };
}

function Harness({ formDefaults = defaults() }: { formDefaults?: ChartFormValues } = {}) {
  const form = useForm<ChartFormValues>({ defaultValues: formDefaults });
  return <WorkspaceCanvas control={form.control} experimentId="exp-1" visualizationId="viz-1" />;
}

describe("WorkspaceCanvas", () => {
  it("shows the no-table placeholder when no tableName is selected", () => {
    render(
      <Harness
        formDefaults={defaults({
          dataConfig: { tableName: "", dataSources: [] },
        })}
      />,
    );

    expect(screen.getByText("workspace.canvas.noTable")).toBeInTheDocument();
    expect(screen.getByText("workspace.canvas.selectTable")).toBeInTheDocument();
  });

  it("shows the no-columns placeholder when a table is picked but no columns are configured", () => {
    render(
      <Harness
        formDefaults={defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "", role: "x" },
              { tableName: "readings", columnName: "", role: "y" },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText("workspace.canvas.noColumns")).toBeInTheDocument();
  });

  it("shows the loading state while data is in flight (table + columns set)", () => {
    server.mount(contract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          data: { columns: [], rows: [], totalRows: 0, truncated: false },
        }),
      ],
      delay: 100,
    });

    render(
      <Harness
        formDefaults={defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText("workspace.canvas.loading")).toBeInTheDocument();
  });

  it("renders the chart-area container once data resolves", async () => {
    server.mount(contract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          data: {
            columns: [
              { name: "time", type_name: "DOUBLE", type_text: "DOUBLE" },
              { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
            ],
            rows: [
              { time: 1, temp: 21 },
              { time: 2, temp: 22 },
            ],
            totalRows: 2,
            truncated: false,
          },
        }),
      ],
    });

    render(
      <Harness
        formDefaults={defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
            ],
          },
        })}
      />,
    );

    // Once loading clears, the loading text is gone — implies the renderer
    // chrome (Plotly container) is mounted.
    await waitFor(() =>
      expect(screen.queryByText("workspace.canvas.loading")).not.toBeInTheDocument(),
    );
  });
});
