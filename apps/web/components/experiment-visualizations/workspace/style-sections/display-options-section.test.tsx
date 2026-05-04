import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import type { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { ChartFormValues } from "../../charts/form-values";
import { lineChartType } from "../../charts/line";
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
  it("renders the section heading + the three controls", () => {
    renderWithForm<ChartFormValues>((form) => <DisplayOptionsSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(screen.getByText("workspace.style.display")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.chartTitle")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.showLegend")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.showGrid")).toBeInTheDocument();
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
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <DisplayOptionsSection form={form} />;
      },
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.type(screen.getByPlaceholderText("workspace.style.chartTitlePlaceholder"), "Hello");
    expect(formRef.getValues("config.title")).toBe("Hello");
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
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <DisplayOptionsSection form={form} />;
      },
      { useFormProps: { defaultValues: defaults({ showLegend: true }) } },
    );

    await user.click(screen.getByRole("checkbox", { name: "workspace.style.showLegend" }));
    expect(formRef.getValues("config.showLegend")).toBe(false);

    await user.click(screen.getByRole("checkbox", { name: "workspace.style.showLegend" }));
    expect(formRef.getValues("config.showLegend")).toBe(true);
  });

  it("toggles `config.showGrid` in the form when the grid checkbox is clicked", async () => {
    const user = userEvent.setup();
    let formRef!: ReturnType<typeof useForm<ChartFormValues>>;
    renderWithForm<ChartFormValues>(
      (form) => {
        formRef = form;
        return <DisplayOptionsSection form={form} />;
      },
      { useFormProps: { defaultValues: defaults({ showGrid: false }) } },
    );

    await user.click(screen.getByRole("checkbox", { name: "workspace.style.showGrid" }));
    expect(formRef.getValues("config.showGrid")).toBe(true);
  });
});
