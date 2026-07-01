import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { lollipopChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { LollipopStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lollipopChartType.family,
    chartType: lollipopChartType.type,
    config: lollipopChartType.defaultConfig(),
    dataConfig: lollipopChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "variety", type_name: "VARCHAR", type_text: "STRING" },
  { name: "yield", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <LollipopStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("LollipopStylePanel", () => {
  it("shows orientation, dot size and stem width", () => {
    renderPanel();
    expandSection("workspace.style.lollipopOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.dotSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.stemWidth")).toBeInTheDocument();
  });

  it("does not surface line/scatter-only options", () => {
    renderPanel();
    expandSection("workspace.style.lollipopOptions");
    expect(screen.queryByText("workspace.style.smoothing")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.lineDash")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.markerShape")).not.toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.lollipopOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.dotSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.stemWidth")).toBeInTheDocument();
  });
});
