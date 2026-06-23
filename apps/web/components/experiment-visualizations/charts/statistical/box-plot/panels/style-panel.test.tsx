import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { boxPlotChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { BoxPlotStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: boxPlotChartType.family,
    chartType: boxPlotChartType.type,
    config: boxPlotChartType.defaultConfig(),
    dataConfig: boxPlotChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "total_measurements", type_name: "BIGINT", type_text: "LONG" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <BoxPlotStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("BoxPlotStylePanel", () => {
  it("shows orientation, layout, statistics, points, and markers subsections", () => {
    renderPanel();
    expandSection("workspace.style.boxOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.boxmode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.boxStatistics")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.boxPointsSubsection")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerSubsection")).toBeInTheDocument();
  });

  it("exposes mean overlay, notched, and points-to-draw controls", () => {
    renderPanel();
    expandSection("workspace.style.boxOptions");
    expect(screen.getByText("workspace.style.boxmean")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.notched")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.boxpoints")).toBeInTheDocument();
  });

  it("does NOT expose the histogram-specific binning controls", () => {
    renderPanel();
    expandSection("workspace.style.boxOptions");
    expect(screen.queryByText("workspace.style.histogramBinning")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.histnorm")).not.toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.boxOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.boxmode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.boxmean")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.boxpoints")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });
});
