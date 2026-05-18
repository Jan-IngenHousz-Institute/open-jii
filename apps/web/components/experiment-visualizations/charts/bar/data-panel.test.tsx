import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

import { barChartType } from ".";
import type { ChartFormValues } from "../form-values";
import { BarDataPanel } from "./data-panel";

const EXPERIMENT_ID = "exp-1";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: barChartType.family,
    chartType: barChartType.type,
    config: barChartType.defaultConfig(),
    dataConfig: barChartType.defaultDataConfig("raw_data"),
    ...overrides,
  };
}

const COL_CONTRIB: DataColumn = {
  name: "contributor",
  type_name: "STRUCT",
  type_text: WellKnownColumnTypes.CONTRIBUTOR,
};
const COL_QUESTIONS: DataColumn = {
  name: "questions",
  type_name: "ARRAY",
  type_text: WellKnownColumnTypes.QUESTIONS,
};
const COL_PLOT: DataColumn = { name: "plot", type_name: "STRING", type_text: "STRING" };
const COL_PHI2: DataColumn = { name: "phi2", type_name: "DOUBLE", type_text: "DOUBLE" };

function renderPanel(
  columns: DataColumn[] = [COL_CONTRIB, COL_QUESTIONS, COL_PLOT, COL_PHI2],
  formDefaults?: ChartFormValues,
) {
  vi.mocked(useParams).mockReturnValue({ locale: "en-US", id: EXPERIMENT_ID });
  return renderWithForm<ChartFormValues>((form) => <BarDataPanel form={form} columns={columns} />, {
    useFormProps: { defaultValues: formDefaults ?? defaults() },
  });
}

describe("BarDataPanel", () => {
  it("renders X axis, Y axis, and aggregation pickers", () => {
    renderPanel();
    expect(screen.getByText("workspace.shelves.xAxis")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.yAxis")).toBeInTheDocument();
    expect(screen.getByText("workspace.bar.aggregation")).toBeInTheDocument();
  });

  it("offers CONTRIBUTOR + QUESTIONS + categorical columns on the X picker", async () => {
    const user = userEvent.setup();
    renderPanel();
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[0]);
    const options = await screen.findAllByRole("option");
    const labels = options.map((o) => o.textContent || "");
    expect(labels.some((l) => l.includes("contributor"))).toBe(true);
    expect(labels.some((l) => l.includes("questions"))).toBe(true);
    expect(labels.some((l) => l.includes("plot"))).toBe(true);
  });

  it("offers numeric columns on the Y picker", async () => {
    const user = userEvent.setup();
    renderPanel();
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[1]);
    const options = await screen.findAllByRole("option");
    const labels = options.map((o) => o.textContent || "");
    expect(labels.some((l) => l.includes("phi2"))).toBe(true);
  });

  it("hides the Question picker when X is not a QUESTIONS column", () => {
    renderPanel(undefined, defaults({ config: { ...barChartType.defaultConfig() } }));
    expect(screen.queryByText("workspace.bar.question")).not.toBeInTheDocument();
  });

  it("shows the Question picker and populates it from row data when X is QUESTIONS", async () => {
    server.mount(contract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          name: "raw_data",
          data: {
            columns: [
              {
                name: "questions",
                type_name: "ARRAY",
                type_text: WellKnownColumnTypes.QUESTIONS,
              },
            ],
            rows: [
              {
                questions: JSON.stringify([
                  { question_label: "Plot", question_text: "Plot?", question_answer: "A1" },
                  { question_label: "Crop", question_text: "Crop?", question_answer: "Maize" },
                ]),
              },
              {
                questions: JSON.stringify([
                  { question_label: "Plot", question_text: "Plot?", question_answer: "B2" },
                ]),
              },
            ],
            totalRows: 2,
            truncated: false,
          },
        }),
      ],
    });

    const user = userEvent.setup();
    renderPanel(
      undefined,
      defaults({
        config: {
          ...barChartType.defaultConfig(),
          xColumnType: WellKnownColumnTypes.QUESTIONS,
        },
        dataConfig: {
          tableName: "raw_data",
          dataSources: [
            { tableName: "raw_data", columnName: "questions", role: "x" },
            { tableName: "raw_data", columnName: "", role: "y" },
          ],
        },
      }),
    );

    // Question secondary picker appears immediately.
    expect(screen.getByText("workspace.bar.question")).toBeInTheDocument();

    // After the sample fetch resolves the picker should be enabled and the
    // labels seen in the rows appear when it's opened.
    const triggers = screen.getAllByRole("combobox");
    // Question picker is rendered after X (index 1).
    await waitFor(() => {
      expect(triggers[1]).not.toBeDisabled();
    });
    await user.click(triggers[1]);
    const options = await screen.findAllByRole("option");
    const labels = options.map((o) => o.textContent || "");
    expect(labels).toContain("Plot");
    expect(labels).toContain("Crop");
  });

  it("disables sum / avg / min / max while no Y column is picked", async () => {
    const user = userEvent.setup();
    renderPanel(undefined, defaults());
    // Aggregation picker is the last combobox.
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[triggers.length - 1]);
    const options = await screen.findAllByRole("option");
    const byLabel = new Map(options.map((o) => [o.textContent || "", o]));
    expect(byLabel.get("workspace.bar.aggregations.count")?.getAttribute("aria-disabled")).not.toBe(
      "true",
    );
    expect(byLabel.get("workspace.bar.aggregations.sum")?.getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(byLabel.get("workspace.bar.aggregations.avg")?.getAttribute("aria-disabled")).toBe(
      "true",
    );
  });

  it("shows an empty-state message when no filter rows have been added", () => {
    renderPanel();
    expect(screen.getByText("workspace.shelves.noFiltersHelp")).toBeInTheDocument();
  });

  it("adds a filter row when the 'Add filter' button is clicked", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.queryByText("workspace.shelves.filterColumn")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /addFilter/i }));
    expect(screen.getByText("workspace.shelves.filterColumn")).toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.filterValue")).toBeInTheDocument();
  });

  it("hydrates existing filters from the form state and renders one row each", () => {
    renderPanel(
      undefined,
      defaults({
        dataConfig: {
          tableName: "raw_data",
          dataSources: [
            { tableName: "raw_data", columnName: "contributor", role: "x" },
            { tableName: "raw_data", columnName: "", role: "y" },
          ],
          filters: [
            { column: "plot", operator: "equals", value: "A1" },
            { column: "rain", operator: "equals", value: "No" },
          ],
        },
      }),
    );
    expect(screen.getAllByText("workspace.shelves.filterColumn")).toHaveLength(2);
    expect(screen.getAllByText("workspace.shelves.filterValue")).toHaveLength(2);
  });

  it("removes a filter when its trash button is clicked", async () => {
    const user = userEvent.setup();
    renderPanel(
      undefined,
      defaults({
        dataConfig: {
          tableName: "raw_data",
          dataSources: [
            { tableName: "raw_data", columnName: "contributor", role: "x" },
            { tableName: "raw_data", columnName: "", role: "y" },
          ],
          filters: [{ column: "plot", operator: "equals", value: "A1" }],
        },
      }),
    );
    expect(screen.getAllByText("workspace.shelves.filterColumn")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /removeFilter/i }));
    expect(screen.queryByText("workspace.shelves.filterColumn")).not.toBeInTheDocument();
    expect(screen.getByText("workspace.shelves.noFiltersHelp")).toBeInTheDocument();
  });
});
