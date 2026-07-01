import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { correlationMatrixChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { CorrelationMatrixStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: correlationMatrixChartType.family,
    chartType: correlationMatrixChartType.type,
    config: correlationMatrixChartType.defaultConfig(),
    dataConfig: correlationMatrixChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [
  { name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <CorrelationMatrixStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("CorrelationMatrixStylePanel", () => {
  it("shows method, color, and cell-text subsections", () => {
    renderPanel();
    expandSection("workspace.style.correlationMatrixOptions");
    expect(screen.getByText("workspace.style.corrMethod")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.correlationMatrixColor")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.correlationMatrixCellText")).toBeInTheDocument();
  });

  it("exposes colorscale, reverseScale, and show-colorbar controls", () => {
    renderPanel();
    expandSection("workspace.style.correlationMatrixOptions");
    expect(screen.getByText("workspace.shelves.colorScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.reverseScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
  });

  it("exposes show-values and decimals controls", () => {
    renderPanel();
    expandSection("workspace.style.correlationMatrixOptions");
    expect(screen.getByText("workspace.style.corrShowValues")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.corrTextDecimals")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.correlationMatrixOptions");
    expect(screen.getByText("workspace.style.corrMethod")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.corrTextDecimals")).toBeInTheDocument();
  });

  it("renders when corrShowColorbar + corrShowValues are explicitly false", () => {
    renderPanel(defaults({ config: { corrShowColorbar: false, corrShowValues: false } }));
    expandSection("workspace.style.correlationMatrixOptions");
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.corrShowValues")).toBeInTheDocument();
  });

  it("forwards slider commits to form.setValue", () => {
    const { form } = renderPanel();
    expandSection("workspace.style.correlationMatrixOptions");
    const initial = form.getValues("config").corrTextDecimals;
    screen.getAllByRole("slider").forEach((slider) => {
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyUp(slider, { key: "ArrowRight" });
    });
    expect(form.getValues("config").corrTextDecimals).not.toBe(initial);
  });
});
