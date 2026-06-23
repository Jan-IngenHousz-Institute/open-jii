import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import type { ReactElement } from "react";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { DataSourcesFieldArrayProvider } from "../context/data-sources-field-array-context";
import { FacetShelf } from "./facet-shelf";

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

const columns: ExperimentDataColumn[] = [
  { name: "site", type_name: "STRING", type_text: "STRING" },
  { name: "treatment", type_name: "STRING", type_text: "STRING" },
];

describe("FacetShelf", () => {
  it("renders the section heading", () => {
    renderShelf((form) => <FacetShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    expect(
      screen.getByRole("heading", { name: "workspace.shelves.facetDimension" }),
    ).toBeInTheDocument();
  });

  it("appends a facet data source when a column is picked", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <FacetShelf form={form} columns={columns} />, {
      useFormProps: { defaultValues: defaults() },
    });

    // Expand the collapsible first.
    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.facetDimension/ }));
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("site"));

    const sources = form.getValues("dataConfig.dataSources");
    expect(sources.find((d) => d.role === "facet")?.columnName).toBe("site");
  });

  it("updates the existing facet entry instead of appending a second", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <FacetShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              { tableName: "readings", columnName: "site", role: "facet" },
            ],
          },
        }),
      },
    });

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.facetDimension/ }));
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("treatment"));

    const facets = form.getValues("dataConfig.dataSources").filter((d) => d.role === "facet");
    expect(facets).toHaveLength(1);
    expect(facets[0].columnName).toBe("treatment");
  });

  it("removes the facet data source when the user picks 'none'", async () => {
    const user = userEvent.setup();
    const { form } = renderShelf((form) => <FacetShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "temp", role: "y" },
              { tableName: "readings", columnName: "site", role: "facet" },
            ],
          },
        }),
      },
    });

    await user.click(screen.getByRole("button", { name: /workspace\.shelves\.facetDimension/ }));
    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByText("workspace.shelves.facetNone"));

    const facets = form.getValues("dataConfig.dataSources").filter((d) => d.role === "facet");
    expect(facets).toHaveLength(0);
  });

  it("renders the active column label in the header when a facet is set", () => {
    renderShelf((form) => <FacetShelf form={form} columns={columns} />, {
      useFormProps: {
        defaultValues: defaults({
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "time", role: "x" },
              { tableName: "readings", columnName: "site", role: "facet" },
            ],
          },
        }),
      },
    });

    expect(screen.getByText("(site)")).toBeInTheDocument();
  });
});
