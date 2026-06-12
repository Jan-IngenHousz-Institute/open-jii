import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { MarkerStyleSection } from "./marker-style-section";

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

describe("MarkerStyleSection", () => {
  it("renders the section heading with the default key", () => {
    renderWithForm<ChartFormValues>((form) => <MarkerStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });
    expect(
      screen.getByRole("heading", { name: "workspace.style.markerOptions" }),
    ).toBeInTheDocument();
  });

  it("uses a custom titleKey when provided", () => {
    renderWithForm<ChartFormValues>(
      (form) => <MarkerStyleSection form={form} titleKey="workspace.style.barOptions" />,
      { useFormProps: { defaultValues: defaults() } },
    );
    expect(screen.getByRole("heading", { name: "workspace.style.barOptions" })).toBeInTheDocument();
  });

  it("reveals the size + shape controls once expanded", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <MarkerStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.markerOptions" }));
    expect(await screen.findByText("workspace.style.markerSize")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerShape")).toBeInTheDocument();
  });

  it("writes the chosen marker shape back into the form", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>((form) => <MarkerStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.markerOptions" }));
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("workspace.markerSymbols.diamond"));

    expect(form.getValues("config.marker.symbol")).toBe("diamond");
  });
});
