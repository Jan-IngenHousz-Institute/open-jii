import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { dotPlotChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { DotPlotStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: dotPlotChartType.family,
    chartType: dotPlotChartType.type,
    config: dotPlotChartType.defaultConfig(),
    dataConfig: dotPlotChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "variety", type_name: "VARCHAR", type_text: "STRING" },
  { name: "yield", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <DotPlotStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("DotPlotStylePanel", () => {
  it("shows orientation, dot size, shape and opacity by default", () => {
    renderPanel();
    expandSection("workspace.style.dotPlotOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.dotSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerShape")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("does not surface line-only options", () => {
    renderPanel();
    expandSection("workspace.style.dotPlotOptions");
    expect(screen.queryByText("workspace.style.lineWidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.smoothing")).not.toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.dotPlotOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.dotSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerShape")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });
});
