import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { BarStyleSection } from "./bar-style-section";

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

describe("BarStyleSection", () => {
  it("renders the section heading with the default key", () => {
    renderWithForm<ChartFormValues>((form) => <BarStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });
    expect(screen.getByRole("heading", { name: "workspace.style.barOptions" })).toBeInTheDocument();
  });

  it("hides orientation when showOrientation is false (expanded)", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>(
      (form) => <BarStyleSection form={form} showOrientation={false} />,
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("button", { name: "workspace.style.barOptions" }));
    expect(screen.queryByText("workspace.style.orientation")).not.toBeInTheDocument();
    expect(await screen.findByText("workspace.style.barmode")).toBeInTheDocument();
  });

  it("shows orientation + barmode by default once expanded", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <BarStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.barOptions" }));
    expect(await screen.findByText("workspace.style.orientation")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.barmode")).toBeInTheDocument();
  });

  it("does not show barnorm when barmode=group", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <BarStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults({ barmode: "group" }) },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.barOptions" }));
    expect(screen.queryByText("workspace.style.barnorm")).not.toBeInTheDocument();
  });

  it("reveals barnorm when barmode=stack", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <BarStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults({ barmode: "stack" }) },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.barOptions" }));
    expect(await screen.findByText("workspace.style.barnorm")).toBeInTheDocument();
  });

  it("writes the barmode change back to the form", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>((form) => <BarStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults({ barmode: "group" }) },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.barOptions" }));
    const triggers = await screen.findAllByRole("combobox");
    // Orientation is first, barmode is second.
    await user.click(triggers[1]);
    await user.click(await screen.findByText("workspace.barmodes.stack"));

    expect(form.getValues("config.barmode")).toBe("stack");
  });
});
