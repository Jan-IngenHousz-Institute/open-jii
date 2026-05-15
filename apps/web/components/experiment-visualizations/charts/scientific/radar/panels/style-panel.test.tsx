import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { radarChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { RadarStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: radarChartType.family,
    chartType: radarChartType.type,
    config: radarChartType.defaultConfig(),
    dataConfig: radarChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [{ name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" }];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <RadarStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("RadarStylePanel", () => {
  it("exposes fill, fill-opacity, line-width, and show-markers controls", () => {
    renderPanel();
    expandSection("workspace.style.radarOptions");
    expect(screen.getByText("workspace.style.radarFill")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.radarFillOpacity")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.radarLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.radarShowMarkers")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.radarOptions");
    expect(screen.getByText("workspace.style.radarFillOpacity")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.radarLineWidth")).toBeInTheDocument();
  });

  it("renders when radarFill is explicitly false", () => {
    renderPanel(defaults({ config: { radarFill: false } }));
    expandSection("workspace.style.radarOptions");
    expect(screen.getByText("workspace.style.radarFill")).toBeInTheDocument();
  });

  it("forwards slider commits to form.setValue", () => {
    const { form } = renderPanel();
    expandSection("workspace.style.radarOptions");
    const initial = { ...form.getValues("config") };
    screen.getAllByRole("slider").forEach((slider) => {
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyUp(slider, { key: "ArrowRight" });
    });
    const config = form.getValues("config");
    expect(config.radarFillOpacity).not.toBe(initial.radarFillOpacity);
    expect(config.radarLineWidth).not.toBe(initial.radarLineWidth);
  });
});
