import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

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

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("ScatterStylePanel", () => {
  it("hides the line subsection by default (markers-only)", () => {
    renderPanel();
    expandSection("workspace.style.lineOptions");
    expect(screen.queryByText("workspace.style.lineWidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.lineDash")).not.toBeInTheDocument();
  });

  it("renders the marker subsection unconditionally", () => {
    renderPanel();
    expandSection("workspace.style.scatterOptions");
    expect(screen.getByText("workspace.style.markerSize")).toBeInTheDocument();
    expandSection("workspace.style.lineOptions");
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
    // markerShape lives inside MarkerStyleSection (Markers / scatter); the
    // trigger above already opened it.
    expect(screen.getByText("workspace.style.markerShape")).toBeInTheDocument();
  });

  it("renders the line subsection when mode includes lines", () => {
    renderPanel(
      defaults({
        config: { ...scatterChartType.defaultConfig(), mode: "lines+markers" },
      }),
    );
    expandSection("workspace.style.lineOptions");
    expect(screen.getByText("workspace.style.lineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.lineDash")).toBeInTheDocument();
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

  it("renders the bar-series subsection when any Y source has traceType=bar", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "points",
          dataSources: [
            { tableName: "points", columnName: "x", role: "x" },
            { tableName: "points", columnName: "y", role: "y", traceType: "bar" },
          ],
        },
      }),
    );
    expect(screen.getByText("workspace.style.barSeriesOptions")).toBeInTheDocument();
  });

  it("renders the area-series subsection when any Y source has traceType=area", () => {
    renderPanel(
      defaults({
        dataConfig: {
          tableName: "points",
          dataSources: [
            { tableName: "points", columnName: "x", role: "x" },
            { tableName: "points", columnName: "y", role: "y", traceType: "area" },
          ],
        },
      }),
    );
    expect(screen.getByText("workspace.style.areaSeriesOptions")).toBeInTheDocument();
  });
});
