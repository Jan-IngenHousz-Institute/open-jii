import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { LineStyleSection } from "./line-style-section";

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

describe("LineStyleSection", () => {
  it("renders the section heading", () => {
    renderWithForm<ChartFormValues>((form) => <LineStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });
    expect(
      screen.getByRole("heading", { name: "workspace.style.lineOptions" }),
    ).toBeInTheDocument();
  });

  it("shows the line subsection but no marker subsection when mode=lines (expanded)", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <LineStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults({ mode: "lines" }) },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.lineOptions" }));
    expect(await screen.findByText("workspace.style.lineSubsection")).toBeInTheDocument();
    expect(screen.queryByText("workspace.style.markerSubsection")).not.toBeInTheDocument();
  });

  it("shows only the marker subsection when mode=markers", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <LineStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults({ mode: "markers" }) },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.lineOptions" }));
    expect(await screen.findByText("workspace.style.markerSubsection")).toBeInTheDocument();
    expect(screen.queryByText("workspace.style.lineSubsection")).not.toBeInTheDocument();
  });

  it("shows both subsections when mode=lines+markers", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <LineStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults({ mode: "lines+markers" }) },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.lineOptions" }));
    expect(await screen.findByText("workspace.style.lineSubsection")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.markerSubsection")).toBeInTheDocument();
  });

  it("writes mode changes back into the form", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>((form) => <LineStyleSection form={form} />, {
      useFormProps: { defaultValues: defaults({ mode: "lines" }) },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.lineOptions" }));
    // Mode is the first combobox; line.dash trigger renders next once the
    // line subsection expands.
    const triggers = await screen.findAllByRole("combobox");
    await user.click(triggers[0]);
    await user.click(await screen.findByText("workspace.modes.markers"));

    expect(form.getValues("config.mode")).toBe("markers");
  });
});
