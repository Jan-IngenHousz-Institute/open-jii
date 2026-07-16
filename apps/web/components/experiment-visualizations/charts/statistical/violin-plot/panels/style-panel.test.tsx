import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { violinPlotChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { ViolinPlotStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: violinPlotChartType.family,
    chartType: violinPlotChartType.type,
    config: violinPlotChartType.defaultConfig(),
    dataConfig: violinPlotChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "total_measurements", type_name: "BIGINT", type_text: "LONG" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <ViolinPlotStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("ViolinPlotStylePanel", () => {
  it("shows orientation, layout, side, scale mode, overlays, points, and markers", () => {
    renderPanel();
    expandSection("workspace.style.violinOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.violinmode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.violinSide")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.violinScalemode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.violinOverlay")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.boxPointsSubsection")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerSubsection")).toBeInTheDocument();
  });

  it("exposes inner-box and mean-line toggles", () => {
    renderPanel();
    expandSection("workspace.style.violinOptions");
    expect(screen.getByText("workspace.style.violinShowBox")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.violinShowMeanline")).toBeInTheDocument();
  });

  it("does NOT expose Plotly's bandwidth/spanmode knobs", () => {
    renderPanel();
    expandSection("workspace.style.violinOptions");
    expect(screen.queryByText("workspace.style.violinBandwidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.violinSpanmode")).not.toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.violinOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.violinmode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.violinSide")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.violinScalemode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.boxpoints")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("renders when violinShowBox is explicitly false", () => {
    renderPanel(defaults({ config: { violinShowBox: false } }));
    expandSection("workspace.style.violinOptions");
    expect(screen.getByText("workspace.style.violinShowBox")).toBeInTheDocument();
  });
});
