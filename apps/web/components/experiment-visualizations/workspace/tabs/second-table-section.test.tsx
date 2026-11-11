import { createExperimentTable } from "@/test/factories";
import { API_URL } from "@/test/msw/mount";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { joinedColumns } from "@repo/api/transforms/joined-columns";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { SecondTableSection } from "./second-table-section";

const column = (name: string, type_text: string): ExperimentDataColumn => ({
  name,
  type_name: type_text,
  type_text,
});
const primary = [
  column("id", "STRING"),
  column("station", "STRING"),
  column("timestamp", "TIMESTAMP"),
  column("date", "DATE"),
  column("reading", "DOUBLE"),
  column("payload", "VARIANT"),
  column("second__primary", "STRUCT<id: STRING, name: STRING, avatar: STRING>"),
];
const secondary = [
  column("id", "STRING"),
  column("station", "STRING"),
  column("timestamp", "STRING"),
  column("observed_at", "TIMESTAMP"),
  column("uploaded_at", "TIMESTAMP_NTZ"),
  column("reading", "STRING"),
  column("payload", "VARIANT"),
  column("air", "DOUBLE"),
  column("contributor", "STRUCT<id: STRING, name: STRING, avatar: STRING>"),
];

function setup(overrides: Partial<ChartFormValues["dataConfig"]> = {}) {
  const spy = server.mount(contract.experiments.getExperimentTableColumns, {
    body: ({ query }: SpyCall) => ({
      columns: query.join
        ? [...primary, ...joinedColumns(primary, secondary, "weather")]
        : query.tableName === "leaf"
          ? primary
          : secondary,
    }),
  });
  const tables = [
    createExperimentTable({ identifier: "leaf", displayName: "Leaf" }),
    createExperimentTable({ identifier: "weather", displayName: "Weather" }),
    createExperimentTable({ identifier: "alternate", displayName: "Alternate" }),
  ];
  const result = renderWithForm<ChartFormValues>(
    (form) => (
      <SecondTableSection form={form} experimentId="exp-1" tables={tables} tableName="leaf" />
    ),
    {
      useFormProps: {
        defaultValues: {
          name: "Chart",
          chartFamily: lineChartType.family,
          chartType: lineChartType.type,
          config: lineChartType.defaultConfig(),
          dataConfig: {
            tableName: "leaf",
            join: {
              tableName: "weather",
              matchColumn: "station",
              primaryTimeColumn: "timestamp",
              secondaryTimeColumn: "observed_at",
              toleranceMinutes: 5,
            },
            dataSources: [
              { tableName: "leaf", columnName: "timestamp", role: "x" },
              {
                tableName: "leaf",
                columnName: "second__air",
                errorColumn: "second__reading",
                role: "y",
                aggregate: "avg",
              },
            ],
            filters: [
              { column: "reading", operator: "greater_than", value: 0 },
              { column: "second__air", operator: "greater_than", value: 10 },
              { column: "second__contributor.id", operator: "equals", value: "u-1" },
            ],
            aggregation: {
              groupBy: [{ column: "timestamp", timeBucket: "hour" }, { column: "second__air" }],
              functions: [
                { column: "reading", function: "avg", alias: "leaf_mean" },
                { column: "second__air", function: "avg" },
                { column: "reading", function: "corr", secondColumn: "second__air" },
              ],
            },
            ...overrides,
          },
        },
      },
    },
  );
  return { ...result, spy };
}

describe("SecondTableSection", () => {
  it("excludes the primary table and limits match/time choices to compatible metadata", async () => {
    const user = userEvent.setup();
    const { spy } = setup();
    await waitFor(() =>
      expect(spy.calls.some((call) => call.query.tableName === "weather")).toBe(true),
    );
    await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.table" }));
    expect(screen.queryByRole("option", { name: "Leaf" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Weather" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.matchColumn" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "id",
      "station",
    ]);
    await user.keyboard("{Escape}");
    await user.click(
      screen.getByRole("combobox", { name: "workspace.secondTable.primaryTimeColumn" }),
    );
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "timestamp",
      "date",
    ]);
    await user.keyboard("{Escape}");
    await user.click(
      screen.getByRole("combobox", { name: "workspace.secondTable.secondaryTimeColumn" }),
    );
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "observed_at",
      "uploaded_at",
    ]);
  });

  it("clears dependent secondary selections when changing tables and removes the join with None", async () => {
    const user = userEvent.setup();
    const { form, spy } = setup();
    await waitFor(() =>
      expect(spy.calls.some((call) => call.query.tableName === "weather")).toBe(true),
    );
    await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.table" }));
    await user.click(screen.getByRole("option", { name: "Alternate" }));
    expect(form.getValues("dataConfig.dataSources").map((source) => source.columnName)).toEqual([
      "timestamp",
      "",
    ]);
    expect(form.getValues("dataConfig.dataSources")[1].errorColumn).toBeUndefined();
    expect(form.getValues("dataConfig.filters")).toEqual([
      { column: "reading", operator: "greater_than", value: 0 },
    ]);
    expect(form.getValues("dataConfig.dataSources")[1].aggregate).toBeUndefined();
    expect(form.getValues("dataConfig.aggregation")).toEqual({
      groupBy: [{ column: "timestamp", timeBucket: "hour" }],
      functions: [{ column: "reading", function: "avg", alias: "leaf_mean" }],
    });
    expect(form.getValues("dataConfig.join.tableName")).toBe("alternate");
    await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.table" }));
    await user.click(screen.getByRole("option", { name: "workspace.secondTable.none" }));
    expect(form.getValues("dataConfig.join")).toBeUndefined();
  });
  it.each(["Alternate", "workspace.secondTable.none"])(
    "preserves primary configuration when selecting %s from a complete join",
    async (option) => {
      const user = userEvent.setup();
      const { form, spy } = setup({
        dataSources: [{ tableName: "leaf", columnName: "reading", role: "y", aggregate: "avg" }],
      });
      await waitFor(() =>
        expect(spy.calls.some((call) => call.query.tableName === "weather")).toBe(true),
      );
      await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.table" }));
      await user.click(screen.getByRole("option", { name: option }));
      expect(form.getValues("dataConfig.dataSources")[0]).toMatchObject({
        columnName: "reading",
        aggregate: "avg",
      });
      expect(form.getValues("dataConfig.filters")).toEqual([
        { column: "reading", operator: "greater_than", value: 0 },
      ]);
      expect(form.getValues("dataConfig.aggregation")).toEqual({
        groupBy: [{ column: "timestamp", timeBucket: "hour" }],
        functions: [{ column: "reading", function: "avg", alias: "leaf_mean" }],
      });
    },
  );

  it("preserves primary settings when adding the first second table", async () => {
    const user = userEvent.setup();
    const filters = [{ column: "reading", operator: "greater_than" as const, value: 0 }];
    const aggregation = { groupBy: [{ column: "timestamp", timeBucket: "hour" as const }] };
    const { form, spy } = setup({ join: undefined, filters, aggregation });
    await waitFor(() =>
      expect(spy.calls.some((call) => call.query.tableName === "leaf")).toBe(true),
    );
    await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.table" }));
    await user.click(screen.getByRole("option", { name: "Weather" }));
    expect(form.getValues("dataConfig.filters")).toEqual(filters);
    expect(form.getValues("dataConfig.aggregation")).toEqual(aggregation);
  });

  it("drops an aggregation when every entry depends on the second table", async () => {
    const user = userEvent.setup();
    const { form, spy } = setup({
      aggregation: { functions: [{ column: "second__air", function: "avg" }] },
      filters: [{ column: "second__air", operator: "greater_than", value: 10 }],
    });
    await waitFor(() =>
      expect(spy.calls.some((call) => call.query.tableName === "weather")).toBe(true),
    );
    await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.table" }));
    await user.click(screen.getByRole("option", { name: "workspace.secondTable.none" }));
    expect(form.getValues("dataConfig.aggregation")).toBeUndefined();
    expect(form.getValues("dataConfig.filters")).toBeUndefined();
  });
  it("clears secondary references after a failed metadata read while preserving primary prefixed columns", async () => {
    const user = userEvent.setup();
    const { form } = setup({
      filters: [
        { column: "second__primary.id", operator: "equals", value: "u-1" },
        { column: "second__contributor.id", operator: "equals", value: "u-2" },
      ],
    });
    server.use(
      http.get(`${API_URL}/api/v1/experiments/:id/data/columns`, ({ request }) => {
        if (new URL(request.url).searchParams.get("tableName") === "weather") {
          return HttpResponse.json({ message: "Table not found" }, { status: 404 });
        }
      }),
    );
    await screen.findByRole("alert");
    await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.table" }));
    await user.click(screen.getByRole("option", { name: "workspace.secondTable.none" }));
    expect(form.getValues("dataConfig.join")).toBeUndefined();
    expect(form.getValues("dataConfig.dataSources")[1]).toMatchObject({
      columnName: "",
      aggregate: undefined,
      errorColumn: undefined,
    });
    expect(form.getValues("dataConfig.filters")).toEqual([
      { column: "second__primary.id", operator: "equals", value: "u-1" },
    ]);
    expect(form.getValues("dataConfig.aggregation")).toEqual({
      groupBy: [{ column: "timestamp", timeBucket: "hour" }],
      functions: [{ column: "reading", function: "avg", alias: "leaf_mean" }],
    });
  });
});

it("clears secondary Per and Ordered by references while retaining a primary row window", async () => {
  const user = userEvent.setup();
  const { form } = setup({
    dataSources: [
      {
        tableName: "leaf",
        columnName: "reading",
        role: "y",
        aggregate: "previous",
        partitionColumn: "second__station",
        orderColumn: "second__observed_at",
      },
    ],
    aggregation: {
      functions: [
        {
          column: "reading",
          function: "previous",
          partitionColumn: "second__station",
          orderColumn: "second__observed_at",
        },
      ],
    },
  });
  await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.table" }));
  await user.click(screen.getByRole("option", { name: "workspace.secondTable.none" }));
  expect(form.getValues("dataConfig.dataSources.0")).toMatchObject({
    columnName: "reading",
    aggregate: "previous",
  });
  expect(form.getValues("dataConfig.dataSources.0.orderColumn")).toBe("");
  expect(form.getValues("dataConfig.dataSources.0.partitionColumn")).toBe("");
  expect(form.getValues("dataConfig.aggregation.functions.0.orderColumn")).toBeUndefined();
  expect(form.getValues("dataConfig.aggregation.functions.0.partitionColumn")).toBeUndefined();
});
