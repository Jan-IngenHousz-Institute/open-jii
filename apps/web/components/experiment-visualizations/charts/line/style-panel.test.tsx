import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from ".";
import type { ChartFormValues } from "../form-values";
import { LineStylePanel } from "./style-panel";

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

describe("LineStylePanel", () => {
  it("shows the line subsection by default (lines mode)", () => {
    renderPanel();
    expect(screen.getByText("workspace.style.lineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.lineDash")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.smoothing")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.connectGaps")).toBeInTheDocument();
  });

  it("hides the marker subsection when mode has no markers", () => {
    renderPanel();
    expect(screen.queryByText("workspace.style.markerOpacity")).not.toBeInTheDocument();
  });

  it("shows both subsections when mode is lines+markers", () => {
    renderPanel(defaults({ config: { ...lineChartType.defaultConfig(), mode: "lines+markers" } }));
    expect(screen.getByText("workspace.style.lineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("hides the line subsection when mode is markers only", () => {
    renderPanel(defaults({ config: { ...lineChartType.defaultConfig(), mode: "markers" } }));
    expect(screen.queryByText("workspace.style.lineWidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.smoothing")).not.toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });
});
