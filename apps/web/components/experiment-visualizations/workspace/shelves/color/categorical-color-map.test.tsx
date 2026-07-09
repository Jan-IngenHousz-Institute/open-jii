import { server } from "@/test/msw/server";
import { fireEvent, renderWithForm, screen, waitFor } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "../../../charts/basic/line";
import type { ChartFormValues } from "../../../charts/chart-config";
import { CategoricalColorMap } from "./categorical-color-map";

const columns: DataColumn[] = [
  { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "sensor", type_name: "STRING", type_text: "STRING" },
  { name: "contributor", type_name: "STRUCT", type_text: WellKnownColumnTypes.CONTRIBUTOR },
];

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

function contributorDefaults(colorMap: Record<string, string> = {}): ChartFormValues {
  return {
    ...defaults(colorMap),
    dataConfig: {
      tableName: "readings",
      dataSources: [
        { tableName: "readings", columnName: "temp", role: "y" },
        { tableName: "readings", columnName: "contributor", role: "color" },
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
      (form) => <CategoricalColorMap form={form} columns={columns} />,
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
      (form) => <CategoricalColorMap form={form} columns={columns} />,
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

  it("keys a contributor column by display name, not the raw STRUCT JSON", async () => {
    server.mount(contract.experiments.getDistinctColumnValues, {
      body: {
        values: [
          JSON.stringify({ id: "u2", name: "Zoe" }),
          JSON.stringify({ id: "u1", name: "Alice" }),
        ],
        truncated: false,
      },
    });

    const { form, container } = renderWithForm<ChartFormValues>(
      (form) => <CategoricalColorMap form={form} columns={columns} />,
      { useFormProps: { defaultValues: contributorDefaults() } },
    );

    expect(await screen.findByTitle("Alice")).toBeInTheDocument();
    expect(screen.getByTitle("Zoe")).toBeInTheDocument();
    expect(screen.queryByTitle(/"name"/)).not.toBeInTheDocument();

    await waitFor(() => expect(container.querySelectorAll('input[type="color"]')).toHaveLength(2));
    const swatches = container.querySelectorAll<HTMLInputElement>('input[type="color"]');
    fireEvent.change(swatches[0], { target: { value: "#00ff00" } });

    await waitFor(() => {
      expect(form.getValues("config.colorMap")).toEqual({ Alice: "#00ff00" });
    });
  });
});
