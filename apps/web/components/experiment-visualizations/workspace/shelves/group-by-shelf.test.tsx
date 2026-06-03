import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import type { ReactElement } from "react";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { DataSourcesFieldArrayProvider } from "../context/data-sources-field-array-context";
import { GroupByShelf } from "./group-by-shelf";

type RenderFn = (form: UseFormReturn<ChartFormValues>) => ReactElement;
type Opts = Parameters<typeof renderWithForm<ChartFormValues>>[1];

function renderShelf(render: RenderFn, options: Opts) {
  return renderWithForm<ChartFormValues>(
    (form) => (
      <DataSourcesFieldArrayProvider form={form}>{render(form)}</DataSourcesFieldArrayProvider>
    ),
    options,
  );
}

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: {
      tableName: "readings",
      dataSources: [
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "temp", role: "y" },
      ],
    },
    ...overrides,
  };
}

const columns: DataColumn[] = [
  { name: "site", type_name: "STRING", type_text: "STRING" },
  { name: "treatment", type_name: "STRING", type_text: "STRING" },
];

describe("GroupByShelf", () => {
  it("renders the section heading", () => {
    renderShelf((form) => <GroupByShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(screen.getByRole("heading", { name: "workspace.shelves.groupBy" })).toBeInTheDocument();
  });

  it("appends a color data source and forces categorical mode when a column is picked", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <GroupByShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.groupBy/ }));
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("site"));

    const sources = form.getValues("dataConfig.dataSources");
    expect(sources.find((d) => d.role === "color")?.columnName).toBe("site");
    expect(form.getValues("config.colorMode")).toBe("categorical");
  });

  it("removes the color data source when the user picks 'none'", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <GroupByShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              { tableName: "readings", columnName: "site", role: "color" },
            ],
          },
        }),
      },
    });

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.groupBy/ }));
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("workspace.shelves.groupByNone"));

    const colors = form.getValues("dataConfig.dataSources").filter((d) => d.role === "color");
    expect(colors).toHaveLength(0);
  });

  it("updates the existing color data source instead of appending another", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <GroupByShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "site", role: "color" },
            ],
          },
        }),
      },
    });

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.groupBy/ }));
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("treatment"));

    const colors = form.getValues("dataConfig.dataSources").filter((d) => d.role === "color");
    expect(colors).toHaveLength(1);
    expect(colors[0].columnName).toBe("treatment");
  });

  it("renders the active column label in the header when active", () => {
    renderShelf((form) => <GroupByShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "treatment", role: "color" },
            ],
          },
        }),
      },
    });

    expect(screen.getByText("(treatment)")).toBeInTheDocument();
  });
});
