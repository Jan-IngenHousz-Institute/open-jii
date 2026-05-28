import { act, renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { densityPlot2DChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { DensityPlot2DStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: densityPlot2DChartType.family,
    chartType: densityPlot2DChartType.type,
    config: densityPlot2DChartType.defaultConfig(),
    dataConfig: densityPlot2DChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [{ name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" }];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <DensityPlot2DStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("DensityPlot2DStylePanel", () => {
  it("shows points and density-contours subsections", () => {
    renderPanel();
    expandSection("workspace.style.densityPlot2dOptions");
    expect(screen.getByText("workspace.style.densityPlot2dPoints")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.densityPlot2dContour")).toBeInTheDocument();
  });

  it("exposes marker size + opacity for the points layer", () => {
    renderPanel();
    expandSection("workspace.style.densityPlot2dOptions");
    expect(screen.getByText("workspace.style.markerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("exposes bin counts, fill toggle, colorscale, and colorbar controls for the contour layer", () => {
    renderPanel();
    expandSection("workspace.style.densityPlot2dOptions");
    expect(screen.getByText("workspace.style.hist2dNbinsX")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.hist2dNbinsY")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.density2dContourFill")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.densityPlot2dOptions");
    expect(screen.getByText("workspace.style.markerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.hist2dNbinsX")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.hist2dNbinsY")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
  });

  it("renders when density2dShowColorbar is explicitly false", () => {
    renderPanel(defaults({ config: { density2dShowColorbar: false } }));
    expandSection("workspace.style.densityPlot2dOptions");
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
  });

  // Density-plot-2d uses `hideLegend` so slider order after expansion is
  // [density2dMarkerSize, density2dMarkerOpacity, hist2dNbinsX, hist2dNbinsY].
  // Exercises both branches of `v === 0 ? undefined : v` on each bin slider.
  it("forwards bin-slider commits through both branches of the onCommit mapper", () => {
    const { form } = renderPanel(defaults({ config: { hist2dNbinsX: 5, hist2dNbinsY: 5 } }));
    expandSection("workspace.style.densityPlot2dOptions");
    const sliders = screen.getAllByRole("slider");
    const nbinsX = sliders[2];
    const nbinsY = sliders[3];
    fireEvent.keyDown(nbinsX, { key: "ArrowRight" });
    fireEvent.keyUp(nbinsX, { key: "ArrowRight" });
    expect(typeof form.getValues("config.hist2dNbinsX")).toBe("number");

    act(() => form.setValue("config.hist2dNbinsX", 1));
    fireEvent.keyDown(nbinsX, { key: "ArrowLeft" });
    fireEvent.keyUp(nbinsX, { key: "ArrowLeft" });
    expect(form.getValues("config.hist2dNbinsX")).toBeUndefined();

    fireEvent.keyDown(nbinsY, { key: "ArrowRight" });
    fireEvent.keyUp(nbinsY, { key: "ArrowRight" });
    expect(typeof form.getValues("config.hist2dNbinsY")).toBe("number");

    act(() => form.setValue("config.hist2dNbinsY", 1));
    fireEvent.keyDown(nbinsY, { key: "ArrowLeft" });
    fireEvent.keyUp(nbinsY, { key: "ArrowLeft" });
    expect(form.getValues("config.hist2dNbinsY")).toBeUndefined();
  });
});
