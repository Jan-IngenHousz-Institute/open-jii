import { fromPartial } from "@total-typescript/shoehorn";

import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { QueryBuilderService } from "../../../common/modules/databricks/services/query-builder/query-builder.service";
import type { AggregateExpression } from "../../../common/modules/databricks/services/query-builder/query-builder.types";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { ContributorAnonymizerService } from "../../application/services/contributor-anonymizer.service";
import type { ExperimentStoreReadsService } from "../../application/services/experiment-store-reads.service";
import { ExperimentWarehouseReadsService } from "../../application/services/experiment-warehouse-reads.service";
import { PlatformAnnotationsService } from "../../application/services/platform-annotations.service";
import type { ExperimentDto } from "../models/experiment.model";
import type { CachePort } from "../ports/cache.port";
import type { DatabricksPort } from "../ports/databricks.port";
import type { ExperimentAnnotationsRepository } from "./experiment-annotations.repository";
import { ExperimentDataRepository } from "./experiment-data.repository";
import type { FlowRepository } from "./flow.repository";

const column = (name: string, type_text: string): SchemaData["columns"][number] => ({
  name,
  type_text,
  type_name: type_text,
  position: 0,
});

function setup(
  columns = [
    column("id", "STRING"),
    column("timestamp", "TIMESTAMP"),
    column("value", "DOUBLE"),
    column("contributor", WellKnownColumnTypes.CONTRIBUTOR),
  ],
) {
  const build = vi.fn<DatabricksPort["buildExperimentQuery"]>(() => success("SELECT readings"));
  const execute = vi
    .fn<DatabricksPort["executeSqlQuery"]>()
    .mockResolvedValue(success({ columns, rows: [], totalRows: 0, truncated: false }));
  const port = fromPartial<DatabricksPort>({
    CENTRUM_SCHEMA_NAME: "centrum",
    getExperimentTableColumns: vi.fn().mockResolvedValue(success(columns.map(({ name }) => name))),
    getExperimentTableMetadata: vi.fn().mockResolvedValue(
      success(
        ["raw_data", "weather"].map((identifier) => ({
          identifier,
          tableType: identifier === "raw_data" ? "static" : "upload",
          rowCount: 0,
          displayName: null,
          latestRowAt: null,
          schemaRevision: "r1",
        })),
      ),
    ),
    buildExperimentQuery: build,
    executeSqlQuery: execute,
  });
  const cache: CachePort = {
    tryCache: async (_key, fetch) => fetch(),
    invalidate: () => Promise.resolve(),
  };
  const repository = new ExperimentDataRepository(
    port,
    cache,
    cache,
    new ContributorAnonymizerService(),
    new PlatformAnnotationsService(
      fromPartial<ExperimentAnnotationsRepository>({
        findOnRows: () => Promise.resolve(success([])),
      }),
    ),
    new ExperimentWarehouseReadsService(
      port,
      fromPartial<FlowRepository>({
        getByExperimentId: vi.fn().mockResolvedValue(success(null)),
      }),
    ),
    fromPartial<ExperimentStoreReadsService>({}),
  );
  const experiment = fromPartial<ExperimentDto>({
    id: "e1",
    name: "Example",
    anonymizeContributors: false,
  });
  const read = (item: AggregateExpression, anonymizeContributors = false) =>
    repository.getTableData({
      experimentId: experiment.id,
      experiment: { ...experiment, anonymizeContributors },
      tableName: "raw_data",
      source: "warehouse",
      aggregation: { functions: [item] },
    });
  return { read, build, execute, repository, experiment };
}

describe("row-window repository inputs", () => {
  it("enriches ordered aggregates without changing a correlation in the same anonymized read", async () => {
    const { repository, experiment, build } = setup([
      column("id", "STRING"),
      column("timestamp", "TIMESTAMP"),
      column("value", "DOUBLE"),
      column("humidity", "DOUBLE"),
    ]);
    const correlation: AggregateExpression = {
      column: "value",
      function: "corr",
      secondColumn: "humidity",
    };

    const result = await repository.getTableData({
      experimentId: experiment.id,
      experiment: { ...experiment, anonymizeContributors: true },
      tableName: "raw_data",
      source: "warehouse",
      aggregation: {
        functions: [{ column: "value", function: "latest", orderColumn: "timestamp" }, correlation],
      },
    });

    assertSuccess(result);
    const functions = build.mock.calls.find(([query]) => query.aggregation)?.[0].aggregation
      ?.functions;
    expect(functions).toEqual([
      { column: "value", function: "latest", orderColumn: "timestamp", tieBreaker: "id" },
      correlation,
    ]);
  });

  it("stops an ordered read when its column metadata cannot be loaded", async () => {
    const { read, build, execute } = setup();
    const error = AppError.internal("Column metadata is unavailable");
    execute.mockResolvedValueOnce(failure(error));

    const result = await read({
      column: "value",
      function: "change_from_previous",
      orderColumn: "timestamp",
    });

    assertFailure(result);
    expect(result.error).toBe(error);
    expect(build.mock.calls.some(([query]) => query.aggregation !== undefined)).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each(["DOUBLE", "TIMESTAMP", "TIMESTAMP_NTZ", "DATE"])(
    "passes schema type %s and an id tie breaker on a table with no variant payload",
    async (type) => {
      const { read, build } = setup([column("id", "STRING"), column("value", type)]);
      assertSuccess(
        await read({ column: "value", function: "change_from_previous", orderColumn: "value" }),
      );
      const items = build.mock.calls.flatMap(([query]) => query.aggregation?.functions ?? []);
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ valueType: type, tieBreaker: "id" });
    },
  );

  it("leaves the tie breaker empty when no id exists", async () => {
    const { read, build } = setup([column("value", "DOUBLE")]);
    assertSuccess(await read({ column: "value", function: "previous", orderColumn: "value" }));
    expect(
      build.mock.calls.flatMap(([query]) => query.aggregation?.functions ?? [])[0]?.tieBreaker,
    ).toBeUndefined();
  });

  it.each(["partitionColumn", "orderColumn"] as const)(
    "refuses a contributor field used only as %s",
    async (setting) => {
      const { read, execute } = setup();
      const result = await read(
        {
          column: "value",
          function: "previous",
          orderColumn: "timestamp",
          [setting]: "contributor.name",
        },
        true,
      );
      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );

  it("allows partitioning by the whole contributor value", async () => {
    const { read } = setup();
    assertSuccess(
      await read(
        {
          column: "value",
          function: "previous",
          orderColumn: "timestamp",
          partitionColumn: "contributor",
        },
        true,
      ),
    );
  });

  it("uses the joined column's type and the primary row id for a secondary difference", async () => {
    const { repository, experiment, build } = setup([
      column("id", "STRING"),
      column("timestamp", "TIMESTAMP_NTZ"),
      column("station", "STRING"),
    ]);
    const result = await repository.getTableData({
      experimentId: experiment.id,
      experiment,
      tableName: "raw_data",
      source: "warehouse",
      join: {
        tableName: "weather",
        matchColumn: "station",
        primaryTimeColumn: "timestamp",
        secondaryTimeColumn: "timestamp",
        toleranceMinutes: 5,
      },
      aggregation: {
        functions: [
          {
            column: "second__timestamp",
            function: "change_from_previous",
            orderColumn: "timestamp",
          },
        ],
      },
    });
    assertSuccess(result);
    expect(
      build.mock.calls.find(([query]) => query.aggregation)?.[0].aggregation?.functions?.[0],
    ).toMatchObject({ column: "second__timestamp", valueType: "TIMESTAMP_NTZ", tieBreaker: "id" });
  });

  it("resolves difference types case-insensitively", async () => {
    const { read, build } = setup([column("Value", "TIMESTAMP")]);
    assertSuccess(
      await read({ column: "VALUE", function: "change_from_previous", orderColumn: "Value" }),
    );
    expect(
      build.mock.calls.find(([query]) => query.aggregation)?.[0].aggregation?.functions?.[0]
        ?.valueType,
    ).toBe("TIMESTAMP");
  });

  it("lets the warehouse report a renamed or dropped difference column", async () => {
    const { read, build, execute } = setup();
    const builder = new QueryBuilderService();
    build.mockImplementation((query) =>
      builder.buildQuery({ table: "readings", aggregation: query.aggregation }),
    );
    const schema = {
      columns: [column("value", "DOUBLE")],
      rows: [],
      totalRows: 0,
      truncated: false,
    };
    execute.mockImplementation((_schema, sql) =>
      Promise.resolve(
        sql.includes("`removed`")
          ? failure(AppError.badRequest("UNRESOLVED_COLUMN: removed"))
          : success(schema),
      ),
    );
    const result = await read({
      column: "removed",
      function: "change_from_previous",
      orderColumn: "value",
    });
    assertFailure(result);
    expect(result.error.message).toBe("UNRESOLVED_COLUMN: removed");
    expect(execute.mock.calls.some(([, sql]) => sql.includes("(`removed` - LAG(`removed`)"))).toBe(
      true,
    );
  });

  it.each(["latest", "earliest"] as const)(
    "checks anonymization when %s reads a second-table contributor field",
    async (fn) => {
      const { repository, experiment, build } = setup([
        column("id", "STRING"),
        column("timestamp", "TIMESTAMP"),
        column("station", "STRING"),
        column("contributor", WellKnownColumnTypes.CONTRIBUTOR),
      ]);
      const result = await repository.getTableData({
        experimentId: experiment.id,
        experiment: { ...experiment, anonymizeContributors: true },
        tableName: "raw_data",
        source: "warehouse",
        join: {
          tableName: "weather",
          matchColumn: "station",
          primaryTimeColumn: "timestamp",
          secondaryTimeColumn: "timestamp",
          toleranceMinutes: 5,
        },
        aggregation: {
          functions: [
            { column: "second__contributor.name", function: fn, orderColumn: "timestamp" },
          ],
        },
      });
      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      expect(build.mock.calls.some(([query]) => query.aggregation !== undefined)).toBe(false);
    },
  );

  it.each(["previous", "change_from_previous", "row_number", "latest", "earliest"] as const)(
    "refuses whole contributor ordering for %s, including case variants and joins",
    async (fn) => {
      for (const orderColumn of ["contributor", "CONTRIBUTOR", "second__contributor"]) {
        const { repository, experiment, build } = setup([
          column("id", "STRING"),
          column("timestamp", "TIMESTAMP"),
          column("station", "STRING"),
          column("value", "DOUBLE"),
          column("contributor", WellKnownColumnTypes.CONTRIBUTOR),
        ]);
        const result = await repository.getTableData({
          experimentId: experiment.id,
          experiment: { ...experiment, anonymizeContributors: true },
          tableName: "raw_data",
          source: "warehouse",
          ...(orderColumn === "second__contributor"
            ? {
                join: {
                  tableName: "weather",
                  matchColumn: "station",
                  primaryTimeColumn: "timestamp",
                  secondaryTimeColumn: "timestamp",
                  toleranceMinutes: 5,
                },
              }
            : {}),
          aggregation: { functions: [{ column: "value", function: fn, orderColumn }] },
        });
        assertFailure(result);
        expect(result.error.statusCode).toBe(400);
        expect(build.mock.calls.some(([query]) => query.aggregation !== undefined)).toBe(false);
      }
    },
  );

  it.each(["latest", "earliest"] as const)("sets an id tie breaker for %s", async (fn) => {
    const { read, build } = setup();
    assertSuccess(await read({ column: "value", function: fn, orderColumn: "timestamp" }));
    expect(
      build.mock.calls.find(([query]) => query.aggregation)?.[0].aggregation?.functions?.[0]
        ?.tieBreaker,
    ).toBe("id");
  });

  it("uses resolved metadata to reject a string difference with a bad request", async () => {
    const { read, build } = setup([column("value", "STRING")]);
    const builder = new QueryBuilderService();
    build.mockImplementation((query) =>
      builder.buildQuery({ table: "readings", aggregation: query.aggregation }),
    );
    const result = await read({
      column: "value",
      function: "change_from_previous",
      orderColumn: "value",
    });
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
    expect(result.error.message).toContain("requires a numeric");
  });
});
