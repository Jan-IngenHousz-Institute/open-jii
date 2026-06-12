import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { LineStylePanel } from "../panels/style-panel";

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

const columns: DataColumn[] = [
  { name: "x", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "y", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <LineStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("LineStylePanel", () => {
  it("shows the line subsection by default (lines mode)", () => {
    renderPanel();
    expandSection("workspace.style.lineOptions");
    expect(screen.getByText("workspace.style.lineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.lineDash")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.smoothing")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.connectGaps")).toBeInTheDocument();
  });

  it("hides the marker subsection when mode has no markers", () => {
    renderPanel();
    expandSection("workspace.style.lineOptions");
    expect(screen.queryByText("workspace.style.markerOpacity")).not.toBeInTheDocument();
  });

  it("shows both subsections when mode is lines+markers", () => {
    renderPanel(defaults({ config: { ...lineChartType.defaultConfig(), mode: "lines+markers" } }));
    expandSection("workspace.style.lineOptions");
    expect(screen.getByText("workspace.style.lineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("hides the line subsection when mode is markers only", () => {
    renderPanel(defaults({ config: { ...lineChartType.defaultConfig(), mode: "markers" } }));
    expandSection("workspace.style.lineOptions");
    expect(screen.queryByText("workspace.style.lineWidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.smoothing")).not.toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("renders the scatter-series subsection when any Y source has traceType=scatter", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "readings",
          dataSources: [
            { tableName: "readings", columnName: "time", role: "x" },
            { tableName: "readings", columnName: "temp", role: "y", traceType: "scatter" },
          ],
        },
      }),
    );
    expect(screen.getByText("workspace.style.scatterSeriesOptions")).toBeInTheDocument();
  });

  it("renders the bar-series subsection when any Y source has traceType=bar", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "readings",
          dataSources: [
            { tableName: "readings", columnName: "time", role: "x" },
            { tableName: "readings", columnName: "temp", role: "y", traceType: "bar" },
          ],
        },
      }),
    );
    expect(screen.getByText("workspace.style.barSeriesOptions")).toBeInTheDocument();
  });

  it("renders the area-series subsection when any Y source has traceType=area", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "readings",
          dataSources: [
            { tableName: "readings", columnName: "time", role: "x" },
            { tableName: "readings", columnName: "temp", role: "y", traceType: "area" },
          ],
        },
      }),
    );
    expect(screen.getByText("workspace.style.areaSeriesOptions")).toBeInTheDocument();
  });
});
