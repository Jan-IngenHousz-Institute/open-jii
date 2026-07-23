import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { ridgePlotChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { RidgePlotStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: ridgePlotChartType.family,
    chartType: ridgePlotChartType.type,
    config: ridgePlotChartType.defaultConfig(),
    dataConfig: ridgePlotChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "total_measurements", type_name: "BIGINT", type_text: "LONG" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <RidgePlotStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("RidgePlotStylePanel", () => {
  it("shows overlap, fill, sort-order, and appearance subsection", () => {
    renderPanel();
    expandSection("workspace.style.ridgeOptions");
    expect(screen.getByText("workspace.style.ridgeOverlap")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.ridgeFill")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.ridgeSortOrder")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.ridgeAppearance")).toBeInTheDocument();
  });

  it("exposes line-width and marker-opacity controls", () => {
    renderPanel();
    expandSection("workspace.style.ridgeOptions");
    expect(screen.getByText("workspace.style.ridgeLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("does NOT expose KDE bandwidth / kernel choice (intentionally cut)", () => {
    renderPanel();
    expandSection("workspace.style.ridgeOptions");
    expect(screen.queryByText("workspace.style.ridgeBandwidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.ridgeKernel")).not.toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.ridgeOptions");
    expect(screen.getByText("workspace.style.ridgeOverlap")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.ridgeSortOrder")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.ridgeLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("renders when ridgeFill is explicitly false", () => {
    renderPanel(defaults({ config: { ridgeFill: false } }));
    expandSection("workspace.style.ridgeOptions");
    expect(screen.getByText("workspace.style.ridgeFill")).toBeInTheDocument();
  });
});
