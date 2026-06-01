import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { windRoseChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { WindRoseStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: windRoseChartType.family,
    chartType: windRoseChartType.type,
    config: windRoseChartType.defaultConfig(),
    dataConfig: windRoseChartType.defaultDataConfig(),
    ...overrides,
  };
}

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <WindRoseStylePanel form={form} columns={[]} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("WindRoseStylePanel", () => {
  it("exposes binning controls (direction bins + value bins)", () => {
    renderPanel();
    expandSection("workspace.style.windRoseOptions");
    expect(screen.getByText("workspace.style.windRoseDirectionBins")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.windRoseValueBins")).toBeInTheDocument();
  });

  it("exposes a colorscale picker + reverse toggle", () => {
    renderPanel();
    expandSection("workspace.style.windRoseOptions");
    expect(screen.getByText("workspace.shelves.colorScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.reverseScale")).toBeInTheDocument();
  });

  it("exposes a compass-labels toggle", () => {
    renderPanel();
    expandSection("workspace.style.windRoseOptions");
    expect(screen.getByText("workspace.style.windRoseShowDirectionLabels")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.windRoseOptions");
    expect(screen.getByText("workspace.style.windRoseDirectionBins")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.windRoseValueBins")).toBeInTheDocument();
  });

  it("renders when windRoseShowDirectionLabels is explicitly false", () => {
    renderPanel(defaults({ config: { windRoseShowDirectionLabels: false } }));
    expandSection("workspace.style.windRoseOptions");
    expect(screen.getByText("workspace.style.windRoseShowDirectionLabels")).toBeInTheDocument();
  });

  it("forwards slider commits to form.setValue", () => {
    const { form } = renderPanel();
    expandSection("workspace.style.windRoseOptions");
    screen.getAllByRole("slider").forEach((slider) => {
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyUp(slider, { key: "ArrowRight" });
    });
    expect(typeof form.getValues("config").windRoseValueBins).toBe("number");
  });
});
