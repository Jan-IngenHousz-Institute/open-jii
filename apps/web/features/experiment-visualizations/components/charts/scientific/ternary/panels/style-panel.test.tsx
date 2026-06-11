import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ternaryChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { TernaryStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: ternaryChartType.family,
    chartType: ternaryChartType.type,
    config: ternaryChartType.defaultConfig(),
    dataConfig: ternaryChartType.defaultDataConfig(),
    ...overrides,
  };
}

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>((form) => <TernaryStylePanel form={form} columns={[]} />, {
    useFormProps: { defaultValues: formDefaults ?? defaults() },
  });
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("TernaryStylePanel", () => {
  it("exposes drawing-mode + marker-size + line-width controls", () => {
    renderPanel();
    expandSection("workspace.style.ternaryOptions");
    expect(screen.getByText("workspace.style.ternaryMode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.ternaryMarkerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.ternaryLineWidth")).toBeInTheDocument();
  });

  it("exposes the compositional-sum picker (1 vs 100)", () => {
    renderPanel();
    expandSection("workspace.style.ternaryOptions");
    expect(screen.getByText("workspace.style.ternarySum")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.ternaryOptions");
    expect(screen.getByText("workspace.style.ternaryMode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.ternaryMarkerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.ternaryLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.ternarySum")).toBeInTheDocument();
  });

  it("forwards slider commits to form.setValue", () => {
    const { form } = renderPanel();
    expandSection("workspace.style.ternaryOptions");
    const initial = { ...form.getValues("config") };
    screen.getAllByRole("slider").forEach((slider) => {
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyUp(slider, { key: "ArrowRight" });
    });
    const config = form.getValues("config");
    expect(config.ternaryMarkerSize).not.toBe(initial.ternaryMarkerSize);
    expect(config.ternaryLineWidth).not.toBe(initial.ternaryLineWidth);
  });
});
