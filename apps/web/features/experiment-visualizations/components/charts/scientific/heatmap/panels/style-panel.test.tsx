import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { heatmapChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { HeatmapStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: heatmapChartType.family,
    chartType: heatmapChartType.type,
    config: heatmapChartType.defaultConfig(),
    dataConfig: heatmapChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [{ name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" }];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <HeatmapStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("HeatmapStylePanel", () => {
  it("shows smoothing, color, and cell-text subsections", () => {
    renderPanel();
    expandSection("workspace.style.heatmapOptions");
    // Cell aggregate moved out of the Style panel to the Z shelf: it
    // drives the SQL pipeline now, not a chart-level config field.
    expect(screen.queryByText("workspace.style.heatmapCellAggregate")).not.toBeInTheDocument();
    expect(screen.getByText("workspace.style.heatmapZsmooth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.heatmapColor")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.heatmapCellText")).toBeInTheDocument();
  });

  it("exposes colorscale, reverseScale, show-colorbar, and colorbar-title controls", () => {
    renderPanel();
    expandSection("workspace.style.heatmapOptions");
    expect(screen.getByText("workspace.shelves.colorScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.reverseScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
  });

  it("exposes the show-text checkbox and decimals slider", () => {
    renderPanel();
    expandSection("workspace.style.heatmapOptions");
    expect(screen.getByText("workspace.style.heatmapShowText")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.heatmapTextDecimals")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.heatmapOptions");
    expect(screen.getByText("workspace.style.heatmapZsmooth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.heatmapTextDecimals")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
  });

  it("renders when heatmapShowColorbar is explicitly false", () => {
    renderPanel(defaults({ config: { heatmapShowColorbar: false } }));
    expandSection("workspace.style.heatmapOptions");
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
  });

  it("forwards slider commits to form.setValue", () => {
    const { form } = renderPanel();
    expandSection("workspace.style.heatmapOptions");
    screen.getAllByRole("slider").forEach((slider) => {
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyUp(slider, { key: "ArrowRight" });
    });
    expect(typeof form.getValues("config").heatmapTextDecimals).toBe("number");
  });
});
