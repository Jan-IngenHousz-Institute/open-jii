import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { barChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { BarStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: barChartType.family,
    chartType: barChartType.type,
    config: barChartType.defaultConfig(),
    dataConfig: barChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "variety", type_name: "VARCHAR", type_text: "STRING" },
  { name: "yield", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <BarStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("BarStylePanel", () => {
  it("shows orientation, barmode, gap and opacity by default", () => {
    renderPanel();
    expandSection("workspace.style.barOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.barmode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.bargap")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("hides the normalisation control when bars are grouped (default)", () => {
    renderPanel();
    expandSection("workspace.style.barOptions");
    expect(screen.queryByText("workspace.style.barnorm")).not.toBeInTheDocument();
  });

  it("shows the normalisation control when bars are stacked", () => {
    renderPanel(defaults({ config: { ...barChartType.defaultConfig(), barmode: "stack" } }));
    expandSection("workspace.style.barOptions");
    expect(screen.getByText("workspace.style.barnorm")).toBeInTheDocument();
  });

  it("shows the normalisation control when bars are relative", () => {
    renderPanel(defaults({ config: { ...barChartType.defaultConfig(), barmode: "relative" } }));
    expandSection("workspace.style.barOptions");
    expect(screen.getByText("workspace.style.barnorm")).toBeInTheDocument();
  });

  it("hides the normalisation control when bars overlay", () => {
    renderPanel(defaults({ config: { ...barChartType.defaultConfig(), barmode: "overlay" } }));
    expandSection("workspace.style.barOptions");
    expect(screen.queryByText("workspace.style.barnorm")).not.toBeInTheDocument();
  });
});
