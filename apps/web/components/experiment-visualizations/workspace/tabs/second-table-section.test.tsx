import { createExperimentTable } from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { renderWithForm, screen, userEvent, waitFor } from "@/test/test-utils";
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
];

function setup() {
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
              },
            ],
            filters: [{ column: "second__air", operator: "greater_than", value: 10 }],
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
    await waitFor(() => expect(spy.calls.some((call) => call.query.join)).toBe(true));
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
    await waitFor(() => expect(spy.calls.some((call) => call.query.join)).toBe(true));
    await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.table" }));
    await user.click(screen.getByRole("option", { name: "Alternate" }));
    expect(form.getValues("dataConfig.dataSources").map((source) => source.columnName)).toEqual([
      "timestamp",
      "",
    ]);
    expect(form.getValues("dataConfig.dataSources")[1].errorColumn).toBeUndefined();
    expect(form.getValues("dataConfig.filters")).toBeUndefined();
    expect(form.getValues("dataConfig.join.tableName")).toBe("alternate");
    await user.click(screen.getByRole("combobox", { name: "workspace.secondTable.table" }));
    await user.click(screen.getByRole("option", { name: "workspace.secondTable.none" }));
    expect(form.getValues("dataConfig.join")).toBeUndefined();
  });
});
