import { renderWithForm, screen } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { spcControlChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { SPCStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: spcControlChartType.family,
    chartType: spcControlChartType.type,
    config: spcControlChartType.defaultConfig(),
    dataConfig: spcControlChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [{ name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" }];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <SPCStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("SPCStylePanel", () => {
  it("shows control-limits + appearance subsections", () => {
    renderPanel();
    expandSection("workspace.style.spcOptions");
    expect(screen.getByText("workspace.style.spcLimits")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.spcAppearance")).toBeInTheDocument();
  });

  it("exposes sigma multiplier, warning band, and outlier-highlight controls", () => {
    renderPanel();
    expandSection("workspace.style.spcOptions");
    expect(screen.getByText("workspace.style.spcSigmaMultiplier")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.spcShowWarningLimits")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.spcHighlightOutliers")).toBeInTheDocument();
  });

  it("exposes drawing-mode + marker controls", () => {
    renderPanel();
    expandSection("workspace.style.spcOptions");
    expect(screen.getByText("workspace.style.spcMode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("does NOT expose Western Electric / CUSUM / subgroup knobs (intentionally cut)", () => {
    renderPanel();
    expandSection("workspace.style.spcOptions");
    expect(screen.queryByText("workspace.style.spcWesternElectric")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.spcCusum")).not.toBeInTheDocument();
    expect(screen.queryByText("workspace.style.spcSubgroupSize")).not.toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.spcOptions");
    expect(screen.getByText("workspace.style.spcSigmaMultiplier")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.spcMode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("renders when spcHighlightOutliers is explicitly false", () => {
    renderPanel(defaults({ config: { spcHighlightOutliers: false } }));
    expandSection("workspace.style.spcOptions");
    expect(screen.getByText("workspace.style.spcHighlightOutliers")).toBeInTheDocument();
  });
});
