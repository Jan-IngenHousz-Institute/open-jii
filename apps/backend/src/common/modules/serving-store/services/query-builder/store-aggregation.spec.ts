import { createClient } from "@clickhouse/client";
import type { ClickHouseClient } from "@clickhouse/client";
import { ConfigService } from "@nestjs/config";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

import {
  zExperimentAggregationFunction,
  zExperimentDataFilterOperator,
  zExperimentTimeBucketUnit,
  zExperimentWidthBucket,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { StoreQueryParams } from "../../../../../experiments/core/ports/serving-store.port";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { QueryBuilderService } from "../../../databricks/services/query-builder/query-builder.service";
import { ServingStoreAdapter } from "../../serving-store.adapter";
import { ServingStoreClientService } from "../client/client.service";
import { ServingStoreConfigService } from "../config/config.service";
import { MACRO_RESULTS_TABLE } from "./store-tables";

const FIXTURES = resolve(__dirname, "../../../../../../../data/tests/fixtures");
const MIGRATIONS = resolve(
  __dirname,
  "../../../../../../../../packages/database/clickhouse/migrations",
);

const zRow = z.object({
  id: z.number(),
  timestamp: z.string(),
  device_name: z.string().nullable(),
  latitude: z.number().nullable(),
  output: z.string(),
});

const zCase = z.object({
  columns: z.array(z.string()).optional(),
  join: z.object({ matchColumn: z.string(), toleranceMinutes: z.number() }).optional(),
  filters: z
    .array(
      z.object({
        column: z.string(),
        operator: zExperimentDataFilterOperator,
        value: z.union([z.string(), z.number()]),
      }),
    )
    .optional(),
  aggregation: z
    .object({
      groupBy: z
        .array(
          z.object({
            column: z.string(),
            alias: z.string().optional(),
            timeBucket: zExperimentTimeBucketUnit.optional(),
            widthBucket: zExperimentWidthBucket.optional(),
          }),
        )
        .optional(),
      functions: z
        .array(
          z.object({
            column: z.string(),
            function: zExperimentAggregationFunction,
            alias: z.string().optional(),
            secondColumn: z.string().optional(),
            partitionColumn: z.string().optional(),
            orderColumn: z.string().optional(),
            tieBreaker: z.string().optional(),
            valueType: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  ordering: z.object({ column: z.string(), direction: z.enum(["ASC", "DESC"]) }).optional(),
  compare: z.array(z.string()).optional(),
});

const zFixture = z.object({
  schema: z.string(),
  rows: z.array(zRow),
  matchSchema: z.string(),
  matches: z.array(zRow),
  cases: z.record(z.string(), zCase),
});

const zResults = z.record(
  z.string(),
  z.object({
    columns: z.array(z.string()),
    types: z.array(z.string()),
    rows: z.array(z.array(z.union([z.number(), z.string(), z.null()]))),
  }),
);

const FIXTURE = zFixture.parse(
  JSON.parse(readFileSync(resolve(FIXTURES, "chart-parity.json"), "utf-8")),
);

/** The columns the Spark test's view holds, as the warehouse's macro view holds them. */
const SPARK_COLUMNS = ["experiment_id", "id", "timestamp", "date", "device_name", "latitude"];

const STORE_COLUMNS = MACRO_RESULTS_TABLE.columns
  .map(({ name }) => name)
  .filter((name) => name !== "macro_output");

const VARIANTS = [{ columnName: "macro_output", schema: FIXTURE.schema, suffix: "output" }];
const MATCH_VARIANTS = [
  { columnName: "macro_output", schema: FIXTURE.matchSchema, suffix: "output" },
];

/** The second table's columns a time-matched case reads, under the names the join gives them. */
const MATCHED_COLUMNS = [
  { name: "w", alias: "w" },
  { name: "id", alias: "matched_id" },
];

/** A chart read's ceiling and one more, as the repository asks for. */
const CHART_LIMIT = 100_001;

function storeRead(name: string, experimentId = "charts"): StoreQueryParams {
  const { columns, join, filters, aggregation, ordering } = FIXTURE.cases[name];
  return {
    tableName: "m1",
    tableType: "macro",
    experimentId,
    columns,
    join:
      join === undefined
        ? undefined
        : {
            ...join,
            secondary: {
              tableName: "m2",
              tableType: "macro",
              variants: MATCH_VARIANTS,
              reservedColumns: STORE_COLUMNS,
            },
            primaryColumns: [],
            secondaryColumns: MATCHED_COLUMNS,
            primaryTimeColumn: "timestamp",
            primaryTimeType: "TIMESTAMP",
            secondaryTimeColumn: "timestamp",
            secondaryTimeType: "TIMESTAMP",
          },
    variants: VARIANTS,
    reservedColumns: STORE_COLUMNS,
    filters,
    aggregation,
    ordering,
    limit: CHART_LIMIT,
    plotsValues: true,
  };
}

// Spark runs this fixture in apps/data/tests/lib/test_chart_queries.py, which checks its results
// against chart-results.json; the store's spec below expects the same results.
it("keeps the Spark chart fixture in sync with the warehouse's generated queries", async () => {
  const service = new QueryBuilderService();
  const scoped = { whereConditions: [["experiment_id", "charts"]] satisfies [string, string][] };
  const queries = Object.fromEntries(
    Object.entries(FIXTURE.cases).map(
      ([name, { columns, join, filters, aggregation, ordering }]) => {
        const built = service.buildQuery({
          table: "chart_rows",
          ...scoped,
          columns,
          join:
            join === undefined
              ? undefined
              : {
                  ...join,
                  secondary: {
                    table: "chart_matches",
                    ...scoped,
                    variants: MATCH_VARIANTS,
                    reservedColumns: SPARK_COLUMNS,
                  },
                  primaryColumns: [...SPARK_COLUMNS, "n", "v"],
                  secondaryColumns: MATCHED_COLUMNS,
                  primaryTimeColumn: "timestamp",
                  primaryTimeType: "TIMESTAMP",
                  secondaryTimeColumn: "timestamp",
                  secondaryTimeType: "TIMESTAMP",
                },
          variants: VARIANTS,
          reservedColumns: SPARK_COLUMNS,
          filters,
          aggregation,
          ordering,
          limit: CHART_LIMIT,
        });
        assertSuccess(built);
        return [name, built.value];
      },
    ),
  );

  await expect(JSON.stringify(queries, null, 2) + "\n").toMatchFileSnapshot(
    resolve(FIXTURES, "chart-queries.json"),
  );
});

describe("StoreAggregation", () => {
  const adapter = new ServingStoreAdapter(
    new ServingStoreClientService(new ServingStoreConfigService(new ConfigService({}))),
  );

  it("writes integer outputs as text, since a sum or an id may pass 2^53", () => {
    const query = adapter.buildExperimentQuery(storeRead("groupedStats"));

    assertSuccess(query);
    expect(query.value.sql).toMatch(
      /^SELECT `device_name`, `v_sum`, toString\(`n_sum`\) AS `n_sum`/,
    );
    expect(query.value.columns.find(({ name }) => name === "n_sum")).toMatchObject({
      type: "BIGINT",
    });
  });

  it("sorts going up with nulls first, as Spark does", () => {
    const query = adapter.buildExperimentQuery(storeRead("groupedStats"));

    assertSuccess(query);
    expect(query.value.sql).toContain("ORDER BY `device_name` ASC NULLS FIRST");
  });

  it("groups a device as the warehouse groups its struct: a registered one by its client id", () => {
    const query = adapter.buildExperimentQuery({
      ...storeRead("groupedStats"),
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [{ column: "*", function: "count" }],
      },
      ordering: undefined,
      deviceSerials: [["reg-1", "SN1"]],
    });

    assertSuccess(query);
    expect(query.value.sql).toContain(
      "tuple(if(has(__device_client_ids, client_id), client_id, NULL)",
    );
    expect(query.value.columns[0]).toMatchObject({ name: "device", idOf: "device" });
  });

  it("refuses to expand an array into rows, which no chart asks of the store", () => {
    const query = adapter.buildExperimentQuery({
      ...storeRead("groupedStats"),
      aggregation: {
        groupBy: [{ column: "macro" }],
        explode: { column: "macros", alias: "macro" },
      },
    });

    assertFailure(query);
    expect(query.error.code).toBe("INVALID_QUERY_INPUT");
  });
});

/**
 * Each chart case against a real store of the version the store runs, through the migrations'
 * views, compared with Spark's results for the warehouse's own SQL on the same rows. It rebuilds
 * the `store` database, so it runs only against a throwaway store, and skips without one (see
 * serving-store.adapter.spec.ts for the container).
 */
const STORE_URL = process.env.CLICKHOUSE_TEST_URL;
const STORE_USER = process.env.CLICKHOUSE_TEST_USER ?? "default";
const STORE_PASSWORD = process.env.CLICKHOUSE_TEST_PASSWORD ?? "";

describe.skipIf(STORE_URL === undefined)("StoreAggregation against a store", () => {
  let results: z.infer<typeof zResults>;
  let admin: ClickHouseClient;
  let client: ServingStoreClientService;
  let adapter: ServingStoreAdapter;

  beforeAll(async () => {
    results = zResults.parse(
      JSON.parse(readFileSync(resolve(FIXTURES, "chart-results.json"), "utf-8")),
    );
    const url = STORE_URL ?? "";
    const server = createClient({ url, username: STORE_USER, password: STORE_PASSWORD });
    await server.command({ query: "DROP DATABASE IF EXISTS store SYNC" });
    await server.command({ query: "CREATE DATABASE store" });
    await server.close();

    admin = createClient({
      url,
      username: STORE_USER,
      password: STORE_PASSWORD,
      database: "store",
      clickhouse_settings: { json_type_escape_dots_in_keys: 1 },
    });
    for (const statement of migrationStatements()) {
      await admin.command({ query: statement });
    }
    const macroRow = (macroId: string) => (row: z.infer<typeof zRow>) => ({
      experiment_id: "charts",
      id: row.id,
      raw_id: row.id,
      timestamp: row.timestamp,
      device_name: row.device_name,
      latitude: row.latitude,
      macro_id: macroId,
      macro_output: z.record(z.string(), z.unknown()).parse(JSON.parse(row.output)),
      macro_output_text: row.output,
      questions_data: {},
      annotations: [],
      _commit_version: 1,
      _commit_timestamp: "2027-01-02 00:00:00",
    });
    await admin.insert({
      table: "macro_results",
      values: [...FIXTURE.rows.map(macroRow("m1")), ...FIXTURE.matches.map(macroRow("m2"))],
      format: "JSONEachRow",
    });

    const config = new ConfigService({
      servingStore: { url, username: STORE_USER, password: STORE_PASSWORD },
    });
    client = new ServingStoreClientService(new ServingStoreConfigService(config));
    adapter = new ServingStoreAdapter(client);
  });

  afterAll(async () => {
    await client.onModuleDestroy();
    await admin.close();
  });

  it.each(Object.keys(FIXTURE.cases))("returns Spark's series for %s", async (name) => {
    const expected = results[name];
    const query = adapter.buildExperimentQuery(storeRead(name));
    assertSuccess(query);
    const data = await adapter.executeQuery(query.value);
    assertSuccess(data);

    const positions = expected.columns.map((column) =>
      data.value.columns.findIndex(({ name: candidate }) => candidate === column),
    );
    expect(positions.map((position) => data.value.columns[position]?.type_text)).toEqual(
      expected.types,
    );
    const rows = data.value.rows.map((row) =>
      positions.map((position, index) => typedCell(row[position], expected.types[index])),
    );
    expect(rows).toHaveLength(expected.rows.length);
    rows.forEach((row, rowIndex) =>
      row.forEach((cell, index) => expectSameValue(cell, expected.rows[rowIndex][index])),
    );
  });

  it("groups devices as the warehouse groups their structs, an unregistered one by its label", async () => {
    const row = {
      experiment_id: "devices",
      timestamp: "2026-09-07 00:00:00",
      macro_id: "m1",
      macro_output: {},
      questions_data: {},
      annotations: [],
      _commit_version: 1,
      _commit_timestamp: "2026-09-07 00:00:01",
    };
    await admin.insert({
      table: "macro_results",
      values: [
        { ...row, id: 1, raw_id: 1, client_id: "phone-a", device_id: "d2", device_name: "Ambit" },
        { ...row, id: 2, raw_id: 2, client_id: "phone-b", device_id: "d2", device_name: "Ambit" },
        { ...row, id: 3, raw_id: 3, client_id: "reg-1", device_id: "d1", device_name: "Old" },
        { ...row, id: 4, raw_id: 4, client_id: "reg-2", device_id: "d9", device_name: "Probe" },
        { ...row, id: 5, raw_id: 5, client_id: "reg-2", device_id: "d9", device_name: "Probe" },
      ],
      format: "JSONEachRow",
    });

    const query = adapter.buildExperimentQuery({
      ...storeRead("groupedStats", "devices"),
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [
          { column: "*", function: "count" },
          { column: "device.serial_number", function: "count_distinct" },
        ],
      },
      ordering: { column: "device.serial_number", direction: "ASC" },
      deviceSerials: [
        ["reg-1", "SN1"],
        ["reg-2", null],
      ],
    });
    assertSuccess(query);
    const data = await adapter.executeQuery(query.value);
    assertSuccess(data);

    expect(data.value.rows).toEqual([
      ['[null,"Ambit (d2)"]', "2", "1"],
      ['["reg-2","Probe (d9)"]', "2", "1"],
      ['["reg-1","SN1"]', "1", "1"],
    ]);
  });
});

/** A cell as the value Spark's result holds: numbers as numbers, anything else as its text. */
function typedCell(cell: string | null | undefined, type: string): number | string | null {
  if (cell === null || cell === undefined) {
    return null;
  }
  const isNumber = ["BIGINT", "INT", "DOUBLE"].includes(type);
  return isNumber ? Number(cell) : cell;
}

/** Equal, or both NaN, or doubles apart only in their last bits, where sums run in another order. */
function expectSameValue(actual: number | string | null, expected: number | string | null): void {
  const expectedValue = expected === "NaN" ? Number.NaN : expected;
  if (typeof actual === "number" && typeof expectedValue === "number") {
    const tolerance = 1e-12 * Math.max(1, Math.abs(expectedValue));
    const isSame =
      (Number.isNaN(actual) && Number.isNaN(expectedValue)) ||
      Math.abs(actual - expectedValue) <= tolerance;
    expect({ actual, isSame }).toEqual({ actual, isSame: true });
    return;
  }
  expect(actual).toEqual(expectedValue);
}

function migrationStatements(): string[] {
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  return files.flatMap((file) => {
    const statements: string[] = [];
    let lines: string[] = [];
    for (const line of readFileSync(resolve(MIGRATIONS, file), "utf-8").split("\n")) {
      lines.push(line);
      if (line.trimEnd().endsWith(";")) {
        statements.push(lines.join("\n").trimEnd().replace(/;$/, ""));
        lines = [];
      }
    }
    const rest = lines.filter((line) => line.trim() !== "" && !line.trim().startsWith("--"));
    return rest.length > 0 ? [...statements, lines.join("\n")] : statements;
  });
}
