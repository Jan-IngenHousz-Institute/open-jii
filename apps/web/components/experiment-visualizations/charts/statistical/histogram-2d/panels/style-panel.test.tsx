import { act, renderWithForm, screen, userEvent } from "@/test/test-utils";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { histogram2DChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { Histogram2DStylePanel } from "../panels/style-panel";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: histogram2DChartType.family,
    chartType: histogram2DChartType.type,
    config: histogram2DChartType.defaultConfig(),
    dataConfig: histogram2DChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: ExperimentDataColumn[] = [{ name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" }];

function renderPanel(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <Histogram2DStylePanel form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

function expandSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("Histogram2DStylePanel", () => {
  it("shows binning subsection, normalisation, and color subsection", () => {
    renderPanel();
    expandSection("workspace.style.histogram2dOptions");
    expect(screen.getByText("workspace.style.histogram2dBinning")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.histnorm")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.histogram2dColor")).toBeInTheDocument();
  });

  it("exposes both X and Y bin sliders", () => {
    renderPanel();
    expandSection("workspace.style.histogram2dOptions");
    expect(screen.getByText("workspace.style.hist2dNbinsX")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.hist2dNbinsY")).toBeInTheDocument();
  });

  it("exposes colorscale, show-colorbar, and colorbar-title controls", () => {
    renderPanel();
    expandSection("workspace.style.histogram2dOptions");
    expect(screen.getByText("workspace.shelves.colorScale")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
  });

  it("does NOT expose histfunc (intentionally cut; non-count modes need a z column)", () => {
    renderPanel();
    expandSection("workspace.style.histogram2dOptions");
    expect(screen.queryByText("workspace.style.histfunc")).not.toBeInTheDocument();
  });

  it("renders with an empty config", () => {
    renderPanel(defaults({ config: {} }));
    expandSection("workspace.style.histogram2dOptions");
    expect(screen.getByText("workspace.style.hist2dRenderMode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.hist2dNbinsX")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.hist2dNbinsY")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.histnorm")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.colorAxisTitle")).toBeInTheDocument();
  });

  it("renders when hist2dShowColorbar is explicitly false and hist2dHistnorm is the empty-string sentinel", () => {
    renderPanel(defaults({ config: { hist2dShowColorbar: false, hist2dHistnorm: "" } }));
    expandSection("workspace.style.histogram2dOptions");
    expect(screen.getByText("workspace.shelves.showColorbar")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.histnorm")).toBeInTheDocument();
  });

  // Exercises both branches of `v === 0 ? undefined : v` on the X bin
  // slider: ArrowRight from 5 commits 6 (falsy branch returns v), then
  // setValue to 1 + ArrowLeft commits 0 (truthy branch returns undefined).
  it("forwards X-bin slider commits through both branches of the onCommit mapper", () => {
    const { form } = renderPanel(defaults({ config: { hist2dNbinsX: 5 } }));
    expandSection("workspace.style.histogram2dOptions");
    const slider = screen.getAllByRole("slider")[0];
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(typeof form.getValues("config.hist2dNbinsX")).toBe("number");

    act(() => form.setValue("config.hist2dNbinsX", 1));
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    fireEvent.keyUp(slider, { key: "ArrowLeft" });
    expect(form.getValues("config.hist2dNbinsX")).toBeUndefined();
  });

  // Same coverage for the Y bin slider.
  it("forwards Y-bin slider commits through both branches of the onCommit mapper", () => {
    const { form } = renderPanel(defaults({ config: { hist2dNbinsY: 5 } }));
    expandSection("workspace.style.histogram2dOptions");
    const slider = screen.getAllByRole("slider")[1];
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(typeof form.getValues("config.hist2dNbinsY")).toBe("number");

    act(() => form.setValue("config.hist2dNbinsY", 1));
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    fireEvent.keyUp(slider, { key: "ArrowLeft" });
    expect(form.getValues("config.hist2dNbinsY")).toBeUndefined();
  });

  // Exercises both branches of `value === "none" ? "" : value` on the
  // histnorm Select. The "Off" option triggers the truthy branch (maps to
  // ""); any other option triggers the falsy branch (passes through).
  it("forwards both 'none' and a real histnorm pick through the onValueChange mapper", async () => {
    const user = userEvent.setup();
    const { form } = renderPanel(defaults({ config: { hist2dHistnorm: "percent" } }));
    expandSection("workspace.style.histogram2dOptions");
    // Order after expand with hideLegend: [hoverMode, renderMode, histnorm].
    let histnormCombobox = screen.getAllByRole("combobox")[2];
    await user.click(histnormCombobox);
    await user.click(await screen.findByRole("option", { name: "workspace.histnorms.none" }));
    expect(form.getValues("config.hist2dHistnorm")).toBe("");

    histnormCombobox = screen.getAllByRole("combobox")[2];
    await user.click(histnormCombobox);
    await user.click(await screen.findByRole("option", { name: "workspace.histnorms.percent" }));
    expect(form.getValues("config.hist2dHistnorm")).toBe("percent");
  });
});
