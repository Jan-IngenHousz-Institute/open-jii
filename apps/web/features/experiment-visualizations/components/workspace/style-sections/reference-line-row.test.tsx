import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import type { ReferenceLine } from "../../charts/chart-options";
import { ReferenceLineRow } from "./reference-line-row";

function defaults(overrides: { referenceLines?: ReferenceLine[] } = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: {
      ...lineChartType.defaultConfig(),
      referenceLines: overrides.referenceLines ?? [
        { axis: "y", value: 10, label: "Target", color: "#ff0000", dash: "dash" },
      ],
    },
    dataConfig: lineChartType.defaultDataConfig(),
  };
}

describe("ReferenceLineRow", () => {
  it("renders all four sub-controls (axis, value, color/dash, label)", () => {
    renderWithForm<ChartFormValues>(
      (form) => <ReferenceLineRow form={form} index={0} onRemove={vi.fn()} />,
      { useFormProps: { defaultValues: defaults() } },
    );

    expect(screen.getByText("workspace.style.referenceLineAxis")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.referenceLineValue")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.referenceLineColor")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.referenceLineDash")).toBeInTheDocument();
    expect(screen.getByText("workspace.style.referenceLineLabel")).toBeInTheDocument();
  });

  it("invokes onRemove when the trash button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithForm<ChartFormValues>(
      (form) => <ReferenceLineRow form={form} index={0} onRemove={onRemove} />,
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("button", { name: "workspace.style.referenceLineRemove" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("writes the typed numeric value into the form (parsed as a number)", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <ReferenceLineRow form={form} index={0} onRemove={vi.fn()} />,
      {
        useFormProps: {
          defaultValues: defaults({
            referenceLines: [{ axis: "y", value: 0, label: "", color: "#9ca3af", dash: "dash" }],
          }),
        },
      },
    );

    const valueInput = screen.getByRole("spinbutton");
    await user.clear(valueInput);
    await user.type(valueInput, "42.5");

    const refs = form.getValues("config.referenceLines") as { value: number }[];
    expect(refs[0].value).toBe(42.5);
  });

  it("treats an empty value input as undefined", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <ReferenceLineRow form={form} index={0} onRemove={vi.fn()} />,
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.clear(screen.getByRole("spinbutton"));
    const refs = form.getValues("config.referenceLines") as { value: number | undefined }[];
    expect(refs[0].value).toBeUndefined();
  });

  it("writes the typed label into the form", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <ReferenceLineRow form={form} index={0} onRemove={vi.fn()} />,
      {
        useFormProps: {
          defaultValues: defaults({
            referenceLines: [{ axis: "y", value: 10, label: "", color: "#ff0000", dash: "dash" }],
          }),
        },
      },
    );

    await user.type(screen.getByLabelText("workspace.style.referenceLineLabel"), "Spec");
    const refs = form.getValues("config.referenceLines") as { label: string }[];
    expect(refs[0].label).toBe("Spec");
  });
});
