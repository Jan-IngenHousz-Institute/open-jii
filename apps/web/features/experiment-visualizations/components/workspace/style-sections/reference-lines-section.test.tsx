import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import type { ReferenceLine } from "../../charts/chart-options";
import { ReferenceLinesSection } from "./reference-lines-section";

function defaults(refs: ReferenceLine[] = []): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: { ...lineChartType.defaultConfig(), referenceLines: refs },
    dataConfig: lineChartType.defaultDataConfig(),
  };
}

describe("ReferenceLinesSection", () => {
  it("renders the section heading", () => {
    renderWithForm<ChartFormValues>((form) => <ReferenceLinesSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });
    expect(
      screen.getByRole("heading", { name: "workspace.style.referenceLines" }),
    ).toBeInTheDocument();
  });

  it("shows the empty-state copy when no reference lines exist (expanded)", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <ReferenceLinesSection form={form} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.referenceLines" }));
    expect(await screen.findByText("workspace.style.referenceLinesEmpty")).toBeInTheDocument();
  });

  it("appends a reference line when the add button is pressed", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <ReferenceLinesSection form={form} />,
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("button", { name: "workspace.style.referenceLines" }));
    await user.click(
      await screen.findByRole("button", { name: /workspace\.style\.referenceLineAdd/ }),
    );

    const refs = form.getValues("config.referenceLines") ?? [];
    expect(refs).toHaveLength(1);
    expect(refs[0].axis).toBe("y");
  });

  it("renders one row per existing reference line", async () => {
    const user = userEvent.setup();
    renderWithForm<ChartFormValues>((form) => <ReferenceLinesSection form={form} />, {
      useFormProps: {
        defaultValues: defaults([
          { axis: "y", value: 1, label: "", color: "#9ca3af", dash: "dash" },
          { axis: "x", value: 2, label: "", color: "#9ca3af", dash: "dash" },
        ]),
      },
    });

    await user.click(screen.getByRole("button", { name: "workspace.style.referenceLines" }));
    expect(
      await screen.findAllByRole("button", { name: "workspace.style.referenceLineRemove" }),
    ).toHaveLength(2);
  });

  it("removes a reference line when its row's trash button is clicked", async () => {
    const user = userEvent.setup();
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <ReferenceLinesSection form={form} />,
      {
        useFormProps: {
          defaultValues: defaults([
            { axis: "y", value: 1, label: "", color: "#9ca3af", dash: "dash" },
            { axis: "x", value: 2, label: "", color: "#9ca3af", dash: "dash" },
          ]),
        },
      },
    );

    await user.click(screen.getByRole("button", { name: "workspace.style.referenceLines" }));
    const removes = await screen.findAllByRole("button", {
      name: "workspace.style.referenceLineRemove",
    });
    await user.click(removes[0]);

    const refs = form.getValues("config.referenceLines") ?? [];
    expect(refs).toHaveLength(1);
    expect(refs[0].value).toBe(2);
  });
});
