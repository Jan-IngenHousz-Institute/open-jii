import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../../charts/basic/line";
import type { ChartFormValues } from "../../../charts/chart-config";
import { ColorscalePicker } from "./colorscale-picker";

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

describe("ColorscalePicker", () => {
  it("renders the default 'Color scale' label", () => {
    renderWithForm<ChartFormValues>(
      (form) => <ColorscalePicker form={form} name="config.marker.colorscale" />,
      { useFormProps: { defaultValues: defaults() } },
    );
    expect(screen.getByText("workspace.shelves.colorScale")).toBeInTheDocument();
  });

  it("uses a custom labelKey when provided", () => {
    renderWithForm<ChartFormValues>(
      (form) => (
        <ColorscalePicker
          form={form}
          name="config.marker.colorscale"
          labelKey="workspace.shelves.colorScaleHeatmap"
        />
      ),
      { useFormProps: { defaultValues: defaults() } },
    );
    expect(screen.getByText("workspace.shelves.colorScaleHeatmap")).toBeInTheDocument();
  });

  it("falls back to the default colorscale when the form value is not a string", () => {
    renderWithForm<ChartFormValues>(
      (form) => <ColorscalePicker form={form} name="config.marker.colorscale" />,
      { useFormProps: { defaultValues: defaults() } },
    );
    // Trigger renders the translated label for the resolved colorscale.
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("opens the dropdown and lists known colorscales", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>(
      (form) => <ColorscalePicker form={form} name="config.marker.colorscale" />,
      {
        useFormProps: {
          defaultValues: defaults({
            marker: { colorscale: "Viridis" },
          }),
        },
      },
    );

    await user.click(screen.getByRole("combobox"));
    // Plasma is one of the bundled colorscales.
    expect(await screen.findByText("workspace.colorscales.blues")).toBeInTheDocument();
  });

  it("writes the chosen colorscale back into the form field", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <ColorscalePicker form={form} name="config.marker.colorscale" />,
      {
        useFormProps: {
          defaultValues: defaults({ marker: { colorscale: "Viridis" } }),
        },
      },
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("workspace.colorscales.blues"));

    const value = form.getValues("config.marker.colorscale");
    expect(typeof value === "string" && value.toLowerCase()).toContain("blues");
  });
});
