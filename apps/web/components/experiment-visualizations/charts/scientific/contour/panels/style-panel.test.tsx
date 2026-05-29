import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { contourChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { ContourStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: contourChartType.family,
    chartType: contourChartType.type,
    config: contourChartType.defaultConfig(),
    dataConfig: contourChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "photosynthesis", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <ContourStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("ContourStylePanel", () => {
  it("shows coloring, iso-line subsection, and color subsection", () => {
    renderPanel();
    expandSection("workspace.style.contourOptions");
    expect(screen.queryByText("workspace.style.contourCellAggregate")).not.toBeInTheDocument();
    expect(screen.getByText("workspace.style.contourColoring")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.contourLines")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.contourColor")).toBeInTheDocument();
  });

  it("exposes show-lines and show-labels checkboxes", () => {
    renderPanel();
    expandSection("workspace.style.contourOptions");
    expect(screen.getByText("workspace.style.contourShowLines")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.contourShowLabels")).toBeInTheDocument();
  });

  it("exposes line width, smoothing, and iso-line count sliders", () => {
    renderPanel();
    expandSection("workspace.style.contourOptions");
    expect(screen.getByText("workspace.style.contourLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.contourSmoothing")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.contourNcontours")).toBeInTheDocument();
  });

  it("exposes colorscale, reverseScale, show-colorbar, and colorbar-title controls", () => {
    renderPanel();
    expandSection("workspace.style.contourOptions");
    expect(screen.getByText("workspace.shelves.colorScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.reverseScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.contourOptions");
    expect(screen.getByText("workspace.style.contourColoring")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.contourLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.contourSmoothing")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.contourNcontours")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
  });

  it("renders when contourShowLines + contourShowColorbar are explicitly false", () => {
    renderPanel(defaults({ config: { contourShowLines: false, contourShowColorbar: false } }));
    expandSection("workspace.style.contourOptions");
    expect(screen.getByText("workspace.style.contourShowLines")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
  });

  it("renders the iso-line count badge with an explicit non-zero value", () => {
    renderPanel(defaults({ config: { contourNcontours: 12 } }));
    expandSection("workspace.style.contourOptions");
    expect(screen.getByText("workspace.style.contourNcontours")).toBeInTheDocument();
  });

  it("forwards slider commits to form.setValue", () => {
    const { form } = renderPanel();
    expandSection("workspace.style.contourOptions");
    screen.getAllByRole("slider").forEach((slider) => {
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyUp(slider, { key: "ArrowRight" });
    });
    const config = form.getValues("config");
    expect(typeof config.contourLineWidth).toBe("number");
    expect(typeof config.contourSmoothing).toBe("number");
    expect(typeof config.contourNcontours).toBe("number");
  });
});
