import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { ChartPreview } from "./chart-preview";

vi.mock("../experiment-visualization-renderer", () => ({
  default: ({ visualization }: { visualization: { name: string } }) => (
    <div role="img" aria-label={visualization.name} />
  ),
}));

function mountExperimentData(opts: { delay?: number } = {}) {
  return server.mount(contract.experiments.getExperimentData, {
    body: [createExperimentDataTable()],
    ...opts,
  });
}

const defaultFormValues: ChartFormValues = {
  name: "Test Chart",
  description: "Test Description",
  chartType: "line",
  chartFamily: "basic",
  dataConfig: {
    tableName: "measurements",
    dataSources: [
      { tableName: "measurements", columnName: "temperature", role: "y", alias: "Temp" },
      { tableName: "measurements", columnName: "time", role: "x", alias: "" },
    ],
  },
  config: {
    showGrid: true,
    showLegend: true,
    xAxisTitle: "Time",
    yAxisTitle: "Temperature",
  },
};

function renderChartPreview(formValues: Partial<ChartFormValues> = {}) {
  return renderWithForm<ChartFormValues>(
    (form) => <ChartPreview form={form} experimentId="test-experiment-id" />,
    { useFormProps: { defaultValues: { ...defaultFormValues, ...formValues } } },
  );
}

describe("ChartPreview", () => {
  it("shows no-data-source message when table name is empty", () => {
    renderChartPreview({ dataConfig: { tableName: "", dataSources: [] } });

    expect(screen.getByText("preview.noDataSource")).toBeInTheDocument();
    expect(screen.getByText("preview.selectTable")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows no-columns message when data sources have no column names", () => {
    renderChartPreview({
      dataConfig: {
        tableName: "measurements",
        dataSources: [{ tableName: "measurements", columnName: "", role: "y", alias: "" }],
      },
    });

    expect(screen.getByText("preview.noColumns")).toBeInTheDocument();
    expect(screen.getByText("preview.configureColumns")).toBeInTheDocument();
  });

  it("shows loading message while data is loading", () => {
    mountExperimentData({ delay: 999_999 });
    renderChartPreview();

    expect(screen.getByText("ui.messages.loadingData")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the visualization with chart name", async () => {
    mountExperimentData();
    renderChartPreview();

    expect(await screen.findByRole("img", { name: "Test Chart" })).toBeInTheDocument();
  });

  it("uses default preview name when chart name is empty", async () => {
    mountExperimentData();
    renderChartPreview({ name: "" });

    expect(await screen.findByRole("img", { name: "charts.preview" })).toBeInTheDocument();
  });

  it("handles null description gracefully", async () => {
    mountExperimentData();
    renderChartPreview({ name: "Test Chart", description: null as unknown as string });

    expect(await screen.findByRole("img", { name: "Test Chart" })).toBeInTheDocument();
  });
});
