import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { parallelCoordinatesChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { ParallelCoordinatesStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: parallelCoordinatesChartType.family,
    chartType: parallelCoordinatesChartType.type,
    config: parallelCoordinatesChartType.defaultConfig(),
    dataConfig: parallelCoordinatesChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [{ name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" }];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <ParallelCoordinatesStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("ParallelCoordinatesStylePanel", () => {
  it("exposes line width and opacity sliders", () => {
    renderPanel();
    expandSection("workspace.style.parcoordsOptions");
    expect(screen.getByText("workspace.style.parcoordsLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.parcoordsLineOpacity")).toBeInTheDocument();
  });

  it("does NOT duplicate colorscale / reverseScale controls (those live on the Color dimension shelf)", () => {
    renderPanel();
    expandSection("workspace.style.parcoordsOptions");
    expect(screen.queryByText("workspace.shelves.colorScale")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.shelves.reverseScale")).not.toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.parcoordsOptions");
    expect(screen.getByText("workspace.style.parcoordsLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.parcoordsLineOpacity")).toBeInTheDocument();
  });

  it("forwards slider commits to form.setValue", () => {
    const { form } = renderPanel();
    expandSection("workspace.style.parcoordsOptions");
    screen.getAllByRole("slider").forEach((slider) => {
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyUp(slider, { key: "ArrowRight" });
    });
    const config = form.getValues("config");
    expect(typeof config.parcoordsLineWidth).toBe("number");
    expect(typeof config.parcoordsLineOpacity).toBe("number");
  });
});
