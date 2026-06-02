import { act, renderWithForm, screen, userEvent } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { histogramChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { HistogramStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: histogramChartType.family,
    chartType: histogramChartType.type,
    config: histogramChartType.defaultConfig(),
    dataConfig: histogramChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "total_measurements", type_name: "BIGINT", type_text: "LONG" },
];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <HistogramStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("HistogramStylePanel", () => {
  it("shows orientation, normalisation, layout, and binning + markers subsections", () => {
    renderPanel();
    expandSection("workspace.style.histogramOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.histnorm")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.barmode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.histogramBinning")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerSubsection")).toBeInTheDocument();
  });

  it("does NOT expose the bin-function dropdown (sum/avg need a values column we don't surface yet)", () => {
    renderPanel();
    expandSection("workspace.style.histogramOptions");
    expect(screen.queryByText("workspace.style.histfunc")).not.toBeInTheDocument();
  });

  it("exposes the cumulative toggle and bin-count slider", () => {
    renderPanel();
    expandSection("workspace.style.histogramOptions");
    expect(screen.getByText("workspace.style.cumulative")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.nbinsx")).toBeInTheDocument();
  });

  it("exposes the fitted-normal-curve toggle in the distribution-overlay subsection", () => {
    renderPanel();
    expandSection("workspace.style.histogramOptions");
    expect(screen.getByText("workspace.style.histogramOverlay")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.showNormalFit")).toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.histogramOptions");
    expect(screen.getByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.histnorm")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.barmode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.nbinsx")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerOpacity")).toBeInTheDocument();
  });

  it("renders when histnorm is explicitly the empty-string sentinel for 'none'", () => {
    renderPanel(defaults({ config: { histnorm: "" } }));
    expandSection("workspace.style.histogramOptions");
    expect(screen.getByText("workspace.style.histnorm")).toBeInTheDocument();
  });

  // Histogram has display section without hideLegend, so combobox order
  // is [legendPos, hoverMode, orientation, histnorm, barmode].
  it("forwards both 'none' and a real histnorm pick through the onValueChange mapper", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(defaults({ config: { histnorm: "percent" } }));
    expandSection("workspace.style.histogramOptions");
    let histnormCombobox = screen.getAllByRole("combobox")[3];
    await user.click(histnormCombobox);
    await user.click(await screen.findByRole("option", { name: "workspace.histnorms.none" }));
    expect(form.getValues("config.histnorm")).toBe("");

    histnormCombobox = screen.getAllByRole("combobox")[3];
    await user.click(histnormCombobox);
    await user.click(await screen.findByRole("option", { name: "workspace.histnorms.percent" }));
    expect(form.getValues("config.histnorm")).toBe("percent");
  });

  // Exercises both branches of `v === 0 ? undefined : v` on the nbinsx
  // slider's onCommit.
  it("forwards nbinsx commits through both branches of the onCommit mapper", () => {
    const { form } = renderPanel(defaults({ config: { nbinsx: 5 } }));
    expandSection("workspace.style.histogramOptions");
    const slider = screen.getAllByRole("slider")[0];
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(typeof form.getValues("config.nbinsx")).toBe("number");

    act(() => form.setValue("config.nbinsx", 1));
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    fireEvent.keyUp(slider, { key: "ArrowLeft" });
    expect(form.getValues("config.nbinsx")).toBeUndefined();
  });
});
