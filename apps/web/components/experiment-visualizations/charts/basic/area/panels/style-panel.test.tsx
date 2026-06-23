import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { areaChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { AreaStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: areaChartType.family,
    chartType: areaChartType.type,
    config: areaChartType.defaultConfig(),
    dataConfig: areaChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "x", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "y", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <AreaStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("AreaStylePanel", () => {
  it("shows stack mode, drawing mode and fill opacity by default", () => {
    renderPanel();
    expandSection("workspace.style.areaOptions");
    expect(screen.getByText("workspace.style.stackMode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.fillOpacity")).toBeInTheDocument();
    // `mode` lives in `LineStyleSection` after the refactor (it's a
    // line/scatter concern, area inherits it). Open that section too.
    expandSection("workspace.style.lineOptions");
    expect(screen.getByText("workspace.style.mode")).toBeInTheDocument();
  });

  it("shows the line subsection when mode is lines (default)", () => {
    renderPanel();
    expandSection("workspace.style.lineOptions");
    expect(screen.getByText("workspace.style.lineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.connectGaps")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.smoothing")).toBeInTheDocument();
  });

  it("hides the marker subsection when mode is lines only", () => {
    renderPanel();
    expandSection("workspace.style.lineOptions");
    expect(screen.queryByText("workspace.style.markerOpacity")).not.toBeInTheDocument();
  });

  it("shows both line and marker subsections when mode is lines+markers", () => {
    renderPanel(defaults({ config: { ...areaChartType.defaultConfig(), mode: "lines+markers" } }));
    expandSection("workspace.style.lineOptions");
    expect(screen.getByText("workspace.style.lineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("hides both line and marker subsections in fill-only mode", () => {
    renderPanel(defaults({ config: { ...areaChartType.defaultConfig(), mode: "none" } }));
    expandSection("workspace.style.lineOptions");
    expect(screen.queryByText("workspace.style.lineWidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.markerOpacity")).not.toBeInTheDocument();
  });
});
