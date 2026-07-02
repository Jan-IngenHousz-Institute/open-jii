import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { pieChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { PieStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: pieChartType.family,
    chartType: pieChartType.type,
    config: pieChartType.defaultConfig(),
    dataConfig: pieChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "variety", type_name: "VARCHAR", type_text: "STRING" },
  { name: "yield", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <PieStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("PieStylePanel", () => {
  it("shows hole, text info, text position and sort", () => {
    renderPanel();
    expandSection("workspace.style.pieOptions");
    expect(screen.getByText("workspace.style.pieHole")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.pieTextInfo")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.pieTextPosition")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.pieSortSlices")).toBeInTheDocument();
  });

  it("does not surface axis-bound options like line/scatter modes", () => {
    renderPanel();
    expandSection("workspace.style.pieOptions");
    expect(screen.queryByText("workspace.style.lineWidth")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.markerShape")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.orientation")).not.toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.pieOptions");
    expect(screen.getByText("workspace.style.pieHole")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.pieTextInfo")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.pieTextPosition")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.pieSortSlices")).toBeInTheDocument();
  });
});
