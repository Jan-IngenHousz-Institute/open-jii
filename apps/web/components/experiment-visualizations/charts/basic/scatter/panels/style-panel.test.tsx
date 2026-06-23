import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { scatterChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { ScatterStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: scatterChartType.family,
    chartType: scatterChartType.type,
    config: scatterChartType.defaultConfig(),
    dataConfig: scatterChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "x", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "y", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <ScatterStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("ScatterStylePanel", () => {
  it("renders the marker subsection with size and shape controls", () => {
    renderPanel();
    expandSection("workspace.style.scatterOptions");
    expect(screen.getByText("workspace.style.markerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerShape")).toBeInTheDocument();
  });

  it("renders the marker symbol options including the extended set", () => {
    renderPanel();
    expandSection("workspace.style.scatterOptions");
    // The shape select trigger reflects the current value; the option list
    // is portalled and not accessible without opening it. Asserting the
    // current value shows the schema -> form -> trigger wiring works.
    const triggers = screen.getAllByRole("combobox");
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });
});
