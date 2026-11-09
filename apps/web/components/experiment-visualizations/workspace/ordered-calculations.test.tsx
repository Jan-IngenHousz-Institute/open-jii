import {
  createExperimentDataTable,
  createExperimentTable,
  createVisualization,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
import type { UseFormReturn } from "react-hook-form";
import { I18nextProvider, useTranslation } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { zUpdateExperimentVisualizationBody } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import * as translations from "@repo/i18n";

import german from "../../../../../packages/i18n/locales/de-DE/experimentVisualizations.json";
import { AutosaveStatusProvider } from "../../shared/autosave/autosave-status-context";
import { chartFormResolver } from "../charts/chart-config";
import type { ChartFormValues } from "../charts/chart-config";
import { DataSourcesFieldArrayProvider } from "./context/data-sources-field-array-context";
import { useVisualizationAutosave } from "./hooks/use-visualization-autosave";
import { FacetShelf } from "./shelves/facet-shelf";
import { XAxisShelf } from "./shelves/x-axis-shelf";
import { YAxisShelf } from "./shelves/y-axis-shelf";
import { WorkspaceCanvas } from "./workspace-canvas";

const columns: ExperimentDataColumn[] = [
  { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
  { name: "reading", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "sensor", type_name: "STRING", type_text: "STRING" },
  { name: "site", type_name: "STRING", type_text: "STRING" },
];

function Editor({ form }: { form: UseFormReturn<ChartFormValues> }) {
  useVisualizationAutosave({ form, experimentId: "exp-1", visualizationId: "viz-1" });
  return (
    <DataSourcesFieldArrayProvider form={form}>
      <XAxisShelf form={form} columns={columns} />
      <YAxisShelf form={form} columns={columns} chartType="line" />
      <FacetShelf form={form} columns={columns} flat />
      <WorkspaceCanvas control={form.control} experimentId="exp-1" />
    </DataSourcesFieldArrayProvider>
  );
}

function setup(translate: (key: string) => string = (key) => key, instance?: translations.i18n) {
  server.mount(contract.experiments.getExperimentTableColumns, { body: { columns } });
  server.mount(contract.experiments.getExperimentTables, {
    body: [createExperimentTable({ identifier: "readings" })],
  });
  const reads = server.mount(contract.experiments.getExperimentData, {
    body: [
      createExperimentDataTable({
        data: { columns: [], rows: [], totalRows: 0, truncated: false },
      }),
    ],
  });
  const saves = server.mount(contract.experiments.updateExperimentVisualization, {
    body: createVisualization({ id: "viz-1" }),
  });
  const view = renderWithForm<ChartFormValues>(
    (form) =>
      instance ? (
        <I18nextProvider i18n={instance}>
          <AutosaveStatusProvider>
            <Editor form={form} />
          </AutosaveStatusProvider>
        </I18nextProvider>
      ) : (
        <AutosaveStatusProvider>
          <Editor form={form} />
        </AutosaveStatusProvider>
      ),
    {
      useFormProps: {
        mode: "onChange",
        resolver: chartFormResolver,
        context: { translate },
        defaultValues: {
          name: "Chart",
          chartFamily: "basic",
          chartType: "line",
          config: {},
          dataConfig: {
            tableName: "readings",
            dataSources: [
              { tableName: "readings", columnName: "timestamp", role: "x" },
              {
                tableName: "readings",
                columnName: "timestamp",
                role: "y",
                aggregate: "change_from_previous",
                orderColumn: "timestamp",
                partitionColumn: "sensor",
              },
            ],
          },
        },
      },
    },
  );
  return { ...view, reads, saves };
}

describe("ordered calculation editor transitions", () => {
  it("saves and previews latest/earliest after adding and removing a series", async () => {
    const user = userEvent.setup();
    const { form, saves, reads } = setup();
    const choose = async (label: string, option: string, index = 0) => {
      await user.click(screen.getAllByRole("combobox", { name: label })[index]);
      await user.click(screen.getByRole("option", { name: option }));
    };
    await user.click(screen.getByRole("button", { name: "workspace.shelves.addSeries" }));
    await choose("workspace.shelves.column", "reading DOUBLE", 2);
    await choose("workspace.shelves.timeBucket", "Minute");
    await choose("workspace.shelves.timeBucket", "workspace.shelves.noBucket");
    const removeButtons = screen.getAllByRole("button", { name: "workspace.shelves.removeSeries" });
    await user.click(removeButtons[removeButtons.length - 1]);
    await choose("workspace.shelves.aggregate", "workspace.shelves.aggregateNone");
    await choose("workspace.shelves.column", "reading DOUBLE", 1);
    await choose("workspace.shelves.aggregate", "Average");
    await choose("workspace.shelves.timeBucket", "Minute");
    await choose("workspace.shelves.aggregate", "workspace.shelves.windowFunctions.latest");
    await choose("workspace.shelves.windowOrderedBy", "timestamp");
    const controls = screen.getAllByRole("combobox");
    await user.click(controls[controls.length - 1]);
    await user.click(screen.getByRole("option", { name: "site" }));
    await choose("workspace.shelves.aggregate", "workspace.shelves.windowFunctions.earliest");
    expect(form.getValues("dataConfig.dataSources.1.orderColumn")).toBe("timestamp");
    expect(
      screen.getByRole("combobox", { name: "workspace.shelves.windowOrderedBy" }),
    ).not.toHaveAttribute("aria-invalid", "true");
    await waitFor(
      () =>
        expect(
          reads.calls.some(
            (call) =>
              Object.hasOwn(call.query, "aggregation") &&
              call.query.aggregation.includes('"function":"earliest"'),
          ),
        ).toBe(true),
      { timeout: 3000 },
    );
    await waitFor(
      () => {
        const saved = zUpdateExperimentVisualizationBody.parse(saves.body);
        expect(
          saved.dataConfig.dataSources.find((source) => source.aggregate === "earliest"),
        ).toMatchObject({ orderColumn: "timestamp" });
      },
      { timeout: 3000 },
    );
  }, 20_000);
});

it("does not show a saved ordering default after leaving and reentering a window function", async () => {
  const user = userEvent.setup();
  const { form } = setup();
  const aggregate = screen.getByRole("combobox", { name: "workspace.shelves.aggregate" });
  await user.click(aggregate);
  await user.click(screen.getByRole("option", { name: "workspace.shelves.aggregateNone" }));
  await user.click(aggregate);
  await user.click(
    screen.getByRole("option", { name: "workspace.shelves.windowFunctions.latest" }),
  );
  const order = screen.getByRole("combobox", { name: "workspace.shelves.windowOrderedBy" });
  expect(order).toHaveTextContent("workspace.shelves.selectColumn");
  await user.click(order);
  await user.click(screen.getByRole("option", { name: "timestamp" }));
  expect(form.getValues("dataConfig.dataSources.1.orderColumn")).toBe("timestamp");
});

afterEach(() => vi.restoreAllMocks());

it("keeps German picker errors after the onChange resolver settles", async () => {
  const { createInstance } = await vi.importActual<typeof translations>("@repo/i18n");
  const i18n = createInstance();
  await i18n.init({
    lng: "de-DE",
    defaultNS: "experimentVisualizations",
    resources: { "de-DE": { experimentVisualizations: german } },
    interpolation: { escapeValue: false },
  });
  vi.spyOn(translations, "useTranslation").mockImplementation(
    (ns = "experimentVisualizations", options = {}) => useTranslation(ns, options),
  );
  const user = userEvent.setup();
  const { form } = setup(i18n.getFixedT("de-DE", "experimentVisualizations"), i18n);
  const order = screen.getByRole("combobox", { name: german.workspace.shelves.windowOrderedBy });
  await user.click(order);
  await user.click(screen.getByRole("option", { name: german.workspace.shelves.selectColumn }));
  await act(async () => {
    await form.trigger("dataConfig.dataSources.1.orderColumn");
  });
  expect(order).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText(german.workspace.shelves.windowOrderRequired)).toBeInTheDocument();
});

it("omits empty window fields from preview reads when Per becomes Whole table", async () => {
  const user = userEvent.setup();
  const { reads } = setup();
  await waitFor(() => expect(reads.called).toBe(true));
  const initialReads = reads.calls.length;
  await user.click(screen.getByRole("combobox", { name: "workspace.shelves.windowPer" }));
  await user.click(screen.getByRole("option", { name: "workspace.shelves.windowWholeTable" }));
  await waitFor(() => expect(reads.calls.length).toBeGreaterThan(initialReads));
  const queries = reads.calls.map((call) => call.query.aggregation).join("\n");
  expect(queries).not.toContain('"partitionColumn":""');
  expect(queries).not.toContain('"orderColumn":""');
});
