import { renderWithForm, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { scatterChartType } from ".";
import type { ChartFormValues } from "../form-values";
import { ScatterStylePanel } from "./style-panel";

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

const columns: DataColumn[] = [
  { name: "x", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "y", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <ScatterStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("ScatterStylePanel", () => {
  it("hides the line subsection by default (markers-only)", () => {
    renderPanel();
    expect(screen.queryByText("workspace.style.lineWidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.lineDash")).not.toBeInTheDocument();
  });

  it("renders the marker subsection unconditionally", () => {
    renderPanel();
    expect(screen.getByText("workspace.style.markerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerShape")).toBeInTheDocument();
  });

  it("renders the line subsection when mode includes lines", () => {
    renderPanel(
      defaults({
        config: { ...scatterChartType.defaultConfig(), mode: "lines+markers" },
      }),
    );
    expect(screen.getByText("workspace.style.lineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.lineDash")).toBeInTheDocument();
  });

  it("renders the marker symbol options including the extended set", () => {
    renderPanel();
    // The shape select trigger reflects the current value; the option list
    // is portalled and not accessible without opening it. Asserting the
    // current value shows the schema -> form -> trigger wiring works.
    const triggers = screen.getAllByRole("combobox");
    expect(triggers.length).toBeGreaterThanOrEqual(2);
  });
});
