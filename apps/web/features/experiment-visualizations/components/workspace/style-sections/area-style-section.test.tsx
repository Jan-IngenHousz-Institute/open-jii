import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { AreaStyleSection } from "./area-style-section";

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

describe("AreaStyleSection", () => {
  it("renders the section title using the default i18n key", () => {
    renderWithForm<ChartFormValues>((form) => <AreaStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });
    expect(
      screen.getByRole("heading", { name: "workspace.style.areaOptions" }),
    ).toBeInTheDocument();
  });

  it("uses an overridden titleKey when provided", () => {
    renderWithForm<ChartFormValues>(
      (form) => <AreaStyleSection form={form} titleKey="workspace.style.lineOptions" />,
      { useFormProps: { defaultValues: defaults() } },
    );
    expect(
      screen.getByRole("heading", { name: "workspace.style.lineOptions" }),
    ).toBeInTheDocument();
  });

  it("reveals the stackMode select and fillOpacity slider when expanded", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <AreaStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.areaOptions" }));
    expect(await screen.findByText("workspace.style.stackMode")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.fillOpacity")).toBeInTheDocument();
  });

  it("writes the picked stack mode back into the form", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>((form) => <AreaStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.areaOptions" }));
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("workspace.stackModes.stacked"));

    expect(form.getValues("config.stackMode")).toBe("stacked");
  });
});
