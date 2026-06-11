import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { bubbleChartType } from "../";
import type { ChartFormValues } from "../../../chart-config";
import { BubbleSizeShelf } from "./size-shelf";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: bubbleChartType.family,
    chartType: bubbleChartType.type,
    config: bubbleChartType.defaultConfig(),
    dataConfig: bubbleChartType.defaultDataConfig(),
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "size", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "weight", type_name: "DOUBLE", type_text: "DOUBLE" },
];

function renderShelf(formDefaults?: ChartFormValues) {
  return renderWithForm<ChartFormValues>(
    (form) => <BubbleSizeShelf form={form} columns={columns} />,
    { useFormProps: { defaultValues: formDefaults ?? defaults() } },
  );
}

describe("BubbleSizeShelf", () => {
  it("renders the heading collapsed by default", () => {
    renderShelf();
    expect(
      screen.getByRole("heading", { name: "workspace.shelves.sizeDimension" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("workspace.shelves.column")).not.toBeInTheDocument();
  });

  it("shows the configured size column next to the heading", () => {
    renderShelf(
      defaults({
        dataConfig: {
          tableName: "pts",
          dataSources: [
            { tableName: "pts", columnName: "x", role: "x" },
            { tableName: "pts", columnName: "y", role: "y" },
            { tableName: "pts", columnName: "size", role: "size" },
          ],
        },
      }),
    );
    expect(screen.getByText("(size)")).toBeInTheDocument();
  });

  it("expands the shelf and exposes the column + aggregate controls", async () => {
    const user = userEvent.setup();
    renderShelf();
    await user.click(screen.getByRole("button", { name: /workspace.shelves.sizeDimension/i }));
    expect(await screen.findByText("workspace.shelves.column")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.aggregate")).toBeInTheDocument();
  });

  it("writes the picked size column back into the size data source", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      defaults({
        dataConfig: {
          tableName: "pts",
          dataSources: [
            { tableName: "pts", columnName: "x", role: "x" },
            { tableName: "pts", columnName: "y", role: "y" },
            { tableName: "pts", columnName: "", role: "size" },
          ],
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /workspace.shelves.sizeDimension/i }));
    const combos = await screen.findAllByRole("combobox");
    await user.click(combos[0]);
    await user.click(await screen.findByText("weight"));

    const sizeSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "size");
    expect(sizeSource).toEqual(expect.objectContaining({ columnName: "weight", tableName: "pts" }));
  });

  it("disables the aggregate select until a column is picked", async () => {
    const user = userEvent.setup();
    renderShelf();
    await user.click(screen.getByRole("button", { name: /workspace.shelves.sizeDimension/i }));
    const combos = await screen.findAllByRole("combobox");
    expect(combos[1]).toBeDisabled();
  });

  it("defaults the size aggregate to avg when another source is already aggregating", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      defaults({
        dataConfig: {
          tableName: "pts",
          dataSources: [
            { tableName: "pts", columnName: "x", role: "x" },
            { tableName: "pts", columnName: "y", role: "y", aggregate: "sum" },
            { tableName: "pts", columnName: "", role: "size" },
          ],
        },
      }),
    );
    await user.click(screen.getByRole("button", { name: /workspace.shelves.sizeDimension/i }));
    const combos = await screen.findAllByRole("combobox");
    await user.click(combos[0]);
    await user.click(await screen.findByText("weight"));
    const sizeSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "size");
    expect(sizeSource?.aggregate).toBe("avg");
  });

  it("rewrites the size aggregate when the user picks one explicitly", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf(
      defaults({
        dataConfig: {
          tableName: "pts",
          dataSources: [
            { tableName: "pts", columnName: "x", role: "x" },
            { tableName: "pts", columnName: "y", role: "y" },
            { tableName: "pts", columnName: "size", role: "size" },
          ],
        },
      }),
    );
    await user.click(screen.getByRole("button", { name: /workspace.shelves.sizeDimension/i }));
    const combos = await screen.findAllByRole("combobox");
    await user.click(combos[1]);
    await user.click(await screen.findByText("Sum"));
    const sizeSource = form.getValues("dataConfig.dataSources").find((ds) => ds.role === "size");
    expect(sizeSource?.aggregate).toBe("sum");
  });
});
