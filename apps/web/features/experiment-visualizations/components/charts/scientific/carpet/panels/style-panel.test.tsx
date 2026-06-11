import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { carpetChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { CarpetStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: carpetChartType.family,
    chartType: carpetChartType.type,
    config: carpetChartType.defaultConfig(),
    dataConfig: carpetChartType.defaultDataConfig(),
    ...overrides,
  };
}

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>((form) => <CarpetStylePanel form={form} columns={[]} />, {
    useFormProps: { defaultValues: formDefaults ?? defaults() },
  });
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("CarpetStylePanel", () => {
  it("exposes contour-rendering + count + label controls", () => {
    renderPanel();
    expandSection("workspace.style.carpetOptions");
    expect(screen.getByText("workspace.style.carpetContourColoring")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.carpetNContours")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.carpetShowContourLabels")).toBeInTheDocument();
  });

  it("exposes colorscale + reverse + colorbar + colorbar-title controls", () => {
    renderPanel();
    expandSection("workspace.style.carpetOptions");
    expect(screen.getByText("workspace.shelves.colorScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.reverseScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.carpetOptions");
    expect(screen.getByText("workspace.style.carpetContourColoring")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.carpetNContours")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.carpetShowContourLabels")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.reverseScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
  });

  it("renders when showColorbar is explicitly false", () => {
    renderPanel(defaults({ config: { carpetShowColorbar: false } }));
    expandSection("workspace.style.carpetOptions");
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
  });

  it("forwards slider commits to form.setValue", () => {
    const { form } = renderPanel();
    expandSection("workspace.style.carpetOptions");
    const initial = form.getValues("config").carpetNContours;
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    const next = form.getValues("config").carpetNContours;
    expect(typeof next).toBe("number");
    expect(next).not.toBe(initial);
  });
});
