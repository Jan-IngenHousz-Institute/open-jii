import { server } from "@/test/msw/server";
import { fireEvent, renderWithForm, screen, waitFor } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { lineChartType } from "../../../charts/basic/line";
import type { ChartFormValues } from "../../../charts/chart-config";
import { CategoricalColorMap } from "./categorical-color-map";

function defaults(colorMap: Record<string, string> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: { ...lineChartType.defaultConfig(), colorMap },
    dataConfig: {
      tableName: "readings",
      dataSources: [
        { tableName: "readings", columnName: "temp", role: "y" },
        { tableName: "readings", columnName: "sensor", role: "color" },
      ],
    },
  };
}

describe("CategoricalColorMap", () => {
  beforeEach(() => {
    // The component bails to a palette preview without an experiment id.
    vi.mocked(useParams).mockReturnValue({ id: "exp-1", locale: "en-US" });
    server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: ["alpha", "beta"], truncated: false },
    });
  });

  it("clears a category override when its reset button is clicked", async () => {
    const { form } = renderWithForm<ChartFormValues>(
      (form) => <CategoricalColorMap form={form} />,
      {
        useFormProps: { defaultValues: defaults({ alpha: "#ff0000" }) },
      },
    );

    const reset = await screen.findByRole("button", {
      name: "workspace.shelves.colorMap.resetOne",
    });
    fireEvent.click(reset);

    expect(form.getValues("config.colorMap")).toEqual({});
  });

  it("writes a category override (debounced) when a color is committed", async () => {
    const { form, container } = renderWithForm<ChartFormValues>(
      (form) => <CategoricalColorMap form={form} />,
      { useFormProps: { defaultValues: defaults({ alpha: "#ff0000" }) } },
    );

    // Categories sort alphabetically: [alpha, beta]; wait for both rows.
    await waitFor(() => expect(container.querySelectorAll('input[type="color"]')).toHaveLength(2));
    const swatches = container.querySelectorAll<HTMLInputElement>('input[type="color"]');
    fireEvent.change(swatches[1], { target: { value: "#00ff00" } });

    // Merges against the live colorMap, so the existing alpha override survives.
    await waitFor(() => {
      expect(form.getValues("config.colorMap")).toEqual({ alpha: "#ff0000", beta: "#00ff00" });
    });
  });
});
