import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { DisplayOptionsSection } from "./display-options-section";

function defaults(overrides: Partial<ChartFormValues["config"]> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: { ...lineChartType.defaultConfig(), ...overrides },
    dataConfig: lineChartType.defaultDataConfig(),
  };
}

describe("DisplayOptionsSection", () => {
  it("renders the section heading + every control", () => {
    renderWithForm<ChartFormValues>((form) => <DisplayOptionsSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(screen.getByText("workspace.style.display")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.chartTitle")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.showLegend")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.showGrid")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.legendPosition")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.hoverMode")).toBeInTheDocument();
  });

  it("seeds the title input from the current form value", () => {
    renderWithForm<ChartFormValues>((form) => <DisplayOptionsSection form={form} />, {
      useFormProps: { defaultValues: defaults({ title: "Pollen counts" }) },
    });

    expect(screen.getByDisplayValue("Pollen counts")).toBeInTheDocument();
  });

  it("seeds the title input with an empty string when the value is undefined (no `undefined` text)", () => {
    renderWithForm<ChartFormValues>((form) => <DisplayOptionsSection form={form} />, {
      useFormProps: { defaultValues: defaults({ title: undefined }) },
    });

    const input = screen.getByPlaceholderText("workspace.style.chartTitlePlaceholder");
    expect(input).toHaveValue("");
  });

  it("writes typed characters back into the form's title field", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <DisplayOptionsSection form={form} />,
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.type(screen.getByPlaceholderText("workspace.style.chartTitlePlaceholder"), "Hello");
    expect(form.getValues("config.title")).toBe("Hello");
  });

  it("reflects checkbox state from the form values", () => {
    renderWithForm<ChartFormValues>((form) => <DisplayOptionsSection form={form} />, {
      useFormProps: { defaultValues: defaults({ showLegend: true, showGrid: false }) },
    });

    const legend = screen.getByRole("checkbox", { name: "workspace.style.showLegend" });
    const grid = screen.getByRole("checkbox", { name: "workspace.style.showGrid" });
    expect(legend).toBeChecked();
    expect(grid).not.toBeChecked();
  });

  it("toggles `config.showLegend` in the form when the checkbox is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <DisplayOptionsSection form={form} />,
      { useFormProps: { defaultValues: defaults({ showLegend: true }) } },
    );

    await user.click(screen.getByRole("checkbox", { name: "workspace.style.showLegend" }));
    expect(form.getValues("config.showLegend")).toBe(false);

    await user.click(screen.getByRole("checkbox", { name: "workspace.style.showLegend" }));
    expect(form.getValues("config.showLegend")).toBe(true);
  });

  it("toggles `config.showGrid` in the form when the grid checkbox is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <DisplayOptionsSection form={form} />,
      { useFormProps: { defaultValues: defaults({ showGrid: false }) } },
    );

    await user.click(screen.getByRole("checkbox", { name: "workspace.style.showGrid" }));
    expect(form.getValues("config.showGrid")).toBe(true);
  });

  it("writes the picked legendPosition into the form", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <DisplayOptionsSection form={form} />,
      { useFormProps: { defaultValues: defaults({ legendPosition: "right" }) } },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.style.legendPosition" }));
    await user.click(await screen.findByText("workspace.legendPositions.bottom"));

    expect(form.getValues("config.legendPosition")).toBe("bottom");
  });

  it("writes the picked hoverMode into the form", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <DisplayOptionsSection form={form} />,
      { useFormProps: { defaultValues: defaults({ hoverMode: "closest" }) } },
    );

    await user.click(screen.getByRole("combobox", { name: "workspace.style.hoverMode" }));
    await user.click(await screen.findByText("workspace.hoverModes.xUnified"));

    expect(form.getValues("config.hoverMode")).toBe("x unified");
  });
});
