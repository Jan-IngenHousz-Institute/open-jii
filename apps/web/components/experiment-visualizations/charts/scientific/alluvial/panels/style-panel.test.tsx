import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { alluvialChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { AlluvialStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: alluvialChartType.family,
    chartType: alluvialChartType.type,
    config: alluvialChartType.defaultConfig(),
    dataConfig: alluvialChartType.defaultDataConfig(),
    ...overrides,
  };
}

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <AlluvialStylePanel form={form} columns={[]} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("AlluvialStylePanel", () => {
  it("exposes node thickness + node padding controls", () => {
    renderPanel();
    expandSection("workspace.style.alluvialOptions");
    expect(screen.getByText("workspace.style.alluvialNodeThickness")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.alluvialNodePadding")).toBeInTheDocument();
  });

  it("exposes link opacity control", () => {
    renderPanel();
    expandSection("workspace.style.alluvialOptions");
    expect(screen.getByText("workspace.style.alluvialLinkOpacity")).toBeInTheDocument();
  });

  it("exposes color-mode picker (stage vs unique value)", () => {
    renderPanel();
    expandSection("workspace.style.alluvialOptions");
    expect(screen.getByText("workspace.style.alluvialColorMode")).toBeInTheDocument();
  });

  it("exposes hide-labels toggle", () => {
    renderPanel();
    expandSection("workspace.style.alluvialOptions");
    expect(screen.getByText("workspace.style.alluvialHideLabels")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.alluvialOptions");
    expect(screen.getByText("workspace.style.alluvialNodeThickness")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.alluvialNodePadding")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.alluvialLinkOpacity")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.alluvialColorMode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.alluvialHideLabels")).toBeInTheDocument();
  });

  it("forwards slider commits to form.setValue", () => {
    const { form } = renderPanel();
    expandSection("workspace.style.alluvialOptions");
    const initial = { ...form.getValues("config") };

    const sliders = screen.getAllByRole("slider");
    sliders.forEach((slider) => {
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyUp(slider, { key: "ArrowRight" });
    });

    const config = form.getValues("config");
    expect(config.alluvialNodeThickness).not.toBe(initial.alluvialNodeThickness);
    expect(config.alluvialNodePadding).not.toBe(initial.alluvialNodePadding);
    expect(config.alluvialLinkOpacity).not.toBe(initial.alluvialLinkOpacity);
  });
});
