import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { polarChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { PolarStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: polarChartType.family,
    chartType: polarChartType.type,
    config: polarChartType.defaultConfig(),
    dataConfig: polarChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [{ name: "bearing", type_name: "DOUBLE", type_text: "DOUBLE" }];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <PolarStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("PolarStylePanel", () => {
  it("exposes drawing-mode, marker-size, line-width, and fill controls", () => {
    renderPanel();
    expandSection("workspace.style.polarOptions");
    expect(screen.getByText("workspace.style.polarMode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.polarMarkerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.polarLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.polarFill")).toBeInTheDocument();
  });

  it("exposes angular-layout direction + start-angle controls", () => {
    renderPanel();
    expandSection("workspace.style.polarOptions");
    expect(screen.getByText("workspace.style.polarLayout")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.polarDirection")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.polarStartAngle")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.polarOptions");
    expect(screen.getByText("workspace.style.polarMode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.polarMarkerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.polarLineWidth")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.polarDirection")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.polarStartAngle")).toBeInTheDocument();
  });

  it("forwards slider commits to form.setValue", () => {
    const { form } = renderPanel();
    expandSection("workspace.style.polarOptions");
    const initial = { ...form.getValues("config") };
    screen.getAllByRole("slider").forEach((slider) => {
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyUp(slider, { key: "ArrowRight" });
    });
    const config = form.getValues("config");
    expect(typeof config.polarMarkerSize).toBe("number");
    expect(typeof config.polarLineWidth).toBe("number");
    expect(typeof config.polarStartAngle).toBe("number");
    expect(config.polarMarkerSize).not.toBe(initial.polarMarkerSize);
    expect(config.polarLineWidth).not.toBe(initial.polarLineWidth);
    expect(config.polarStartAngle).not.toBe(initial.polarStartAngle);
  });
});
