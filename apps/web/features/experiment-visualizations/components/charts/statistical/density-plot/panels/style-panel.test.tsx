import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { densityPlotChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { DensityPlotStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: densityPlotChartType.family,
    chartType: densityPlotChartType.type,
    config: densityPlotChartType.defaultConfig(),
    dataConfig: densityPlotChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "total_measurements", type_name: "BIGINT", type_text: "LONG" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <DensityPlotStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("DensityPlotStylePanel", () => {
  it("shows orientation, fill, cumulative, and appearance subsection", () => {
    renderPanel();
    expandSection("workspace.style.densityOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.densityFill")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.densityCumulative")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.densityAppearance")).toBeInTheDocument();
  });

  it("exposes line-width and marker-opacity controls in the appearance subsection", () => {
    renderPanel();
    expandSection("workspace.style.densityOptions");
    expect(screen.getByText("workspace.style.densityLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("does NOT expose KDE bandwidth / kernel choice (intentionally cut)", () => {
    renderPanel();
    expandSection("workspace.style.densityOptions");
    expect(screen.queryByText("workspace.style.densityBandwidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.densityKernel")).not.toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.densityOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.densityLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });
});
