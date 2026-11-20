import { createClient } from "@clickhouse/client";
import type { ClickHouseClient } from "@clickhouse/client";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

import {
  zExperimentAggregationFunction,
  zExperimentDataFilterOperator,
  zExperimentTimeBucketUnit,
  zExperimentWidthBucket,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { StoreQueryParams } from "../../../../../experiments/core/ports/serving-store.port";
import { storeMigrationStatements } from "../../../../../test/store-migrations";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { QueryBuilderService } from "../../../databricks/services/query-builder/query-builder.service";
import { ServingStoreAdapter } from "../../serving-store.adapter";
import { ServingStoreClientService } from "../client/client.service";
import { ServingStoreConfigService } from "../config/config.service";
import { MACRO_RESULTS_TABLE } from "./store-tables";

const FIXTURES = resolve(__dirname, "../../../../../../../data/tests/fixtures");
const MODULE = resolve(__dirname, "../../../../../../../../infrastructure/modules/serving-store");

const zRow = z.object({
  /** The experiment the row belongs to, when not the one most cases read. */
  experiment: z.string().optional(),
  id: z.number(),
  timestamp: z.string(),
  device_name: z.string().nullable(),
  latitude: z.number().nullable(),
  output: z.string(),
});

const zCase = z.object({
  experiment: z.string().optional(),
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
  /** A test cap in place of the read's ceiling, for a table larger than it. */
  limit: z.number().optional(),
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

const METADATA_VARIANT = {
  columnName: "custom_metadata",
  schema: "OBJECT<soil: STRING>",
  suffix: "metadata",
};

/** The second table's columns a time-matched case reads, under the names the join gives them. */
const MATCHED_COLUMNS = [
  { name: "w", alias: "w" },
  { name: "id", alias: "matched_id" },
];

/** A chart read's ceiling and one more, as the repository asks for. */
const CHART_LIMIT = 100_001;

function storeRead(
  name: string,
  experimentId = FIXTURE.cases[name].experiment ?? "charts",
): StoreQueryParams {
  const { columns, join, filters, aggregation, ordering, limit } = FIXTURE.cases[name];
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
    limit: limit ?? CHART_LIMIT,
    isChartRead: true,
  };
}

// Spark runs this fixture in apps/data/tests/lib/test_chart_queries.py, which checks its results
// against chart-results.json; the store's spec below expects the same results.
it("keeps the Spark chart fixture in sync with the warehouse's generated queries", async () => {
  const service = new QueryBuilderService();
  const warehouseRead = ({
    experiment,
    columns,
    join,
    filters,
    aggregation,
    ordering,
    limit,
  }: z.infer<typeof zCase>) => {
    const scoped = {
      whereConditions: [["experiment_id", experiment ?? "charts"]] satisfies [string, string][],
    };
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
      limit: limit ?? CHART_LIMIT,
    });
    assertSuccess(built);
    return built.value;
  };
  const queries = Object.fromEntries(
    Object.entries(FIXTURE.cases).map(([name, read]) => [name, warehouseRead(read)]),
  );

  await expect(JSON.stringify(queries, null, 2) + "\n").toMatchFileSnapshot(
    resolve(FIXTURES, "chart-queries.json"),
  );
});

describe("StoreAggregation", () => {
  const adapter = new ServingStoreAdapter(
    new ServingStoreClientService(new ServingStoreConfigService(new ConfigService({}))),
  );

  it("reads the tables with FINAL in every chart statement, never the views", () => {
    // A table read without FINAL, its alias, if any, coming first.
    const unmerged = /\b(?:measurements|macro_results|uploads)\b(?!(?: AS \w+)? FINAL\b)/;
    for (const name of Object.keys(FIXTURE.cases)) {
      const query = adapter.buildExperimentQuery(storeRead(name));
      assertSuccess(query);

      const readsView = /\bexperiment_\w+\(/.test(query.value.sql);
      expect({ name, readsView }).toEqual({ name, readsView: false });
      expect({ name, unmerged: unmerged.exec(query.value.sql)?.[0] }).toEqual({
        name,
        unmerged: undefined,
      });
      expect(query.value.experiment).toBe(FIXTURE.cases[name].experiment ?? "charts");
    }
  });

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

  it("ranks NaN above every number in a double's min, max, latest and earliest, as Spark does", () => {
    const extremes = adapter.buildExperimentQuery(storeRead("extremesNaN"));
    const picks = adapter.buildExperimentQuery(storeRead("latestAndEarliestByNaN"));

    assertSuccess(extremes);
    assertSuccess(picks);
    expect(extremes.value.sql).toContain("if(countIf(isNaN(`v`)) > 0, nan, maxIf(toNullable(`v`)");
    expect(extremes.value.sql).toContain("ifNull(minIf(toNullable(`v`), NOT isNaN(`v`)), if(");
    expect(picks.value.sql).toContain(
      "argMaxIf(tuple(toNullable(`id`)), tuple(isNaN(`v`), `v`, `id`)",
    );
    expect(picks.value.sql).toContain("argMinIf(tuple(toNullable(`id`)), tuple(isNaN(`v`), `v`)");
  });

  it("finds a capped read's rows by key in the read's own order before reading their payloads", () => {
    const windows = adapter.buildExperimentQuery(storeRead("rowWindowsCappedAlongTheirOrder"));
    const sum = adapter.buildExperimentQuery(storeRead("rowCumsumCapped"));

    assertSuccess(windows);
    assertSuccess(sum);
    expect(windows.value.sql).toMatch(
      /\) IN \(SELECT [^\n]+\nFROM macro_results FINAL\nWHERE [^\n]+\nORDER BY accurateCastOrNull\(macro_output\.`n`, 'Int64'\) ASC NULLS FIRST, id ASC NULLS FIRST, [^\n]+\nLIMIT 4\)/,
    );
    expect(sum.value.sql).toContain("\nORDER BY id ASC NULLS FIRST\nLIMIT 6 WITH TIES)");
  });

  it("keeps every row tied with the last for a running sum along a column rows share", () => {
    const query = adapter.buildExperimentQuery({
      ...storeRead("rowCumsumCapped"),
      ordering: { column: "timestamp", direction: "ASC" },
    });

    assertSuccess(query);
    expect(query.value.sql).toContain("\nORDER BY timestamp ASC NULLS FIRST\nLIMIT 6 WITH TIES)");
  });

  const goingDown: StoreQueryParams = {
    ...storeRead("rowWindowsCappedAlongTheirOrder"),
    ordering: { column: "n", direction: "DESC" },
  };
  it.each([
    ["windows that look back in another order than the read shows", storeRead("rowWindowsCapped")],
    ["a read shown going down", goingDown],
  ])("reads every row before %s", (_case, read) => {
    const query = adapter.buildExperimentQuery(read);

    assertSuccess(query);
    expect(query.value.sql).not.toContain(") IN (SELECT ");
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
      "tuple(if(client_id IN __device_client_ids, client_id, NULL)",
    );
    expect(query.value.columns[0]).toMatchObject({ name: "device", idOf: "device" });
  });

  it("groups a second table's device by its key's text, which a row with no match leaves null", () => {
    const query = adapter.buildExperimentQuery(
      joinedRead({
        aggregation: {
          groupBy: [{ column: "second__device" }],
          functions: [{ column: "*", function: "count" }],
        },
        ordering: undefined,
      }),
    );

    assertSuccess(query);
    expect(query.value.sql).toContain("toJSONString(tuple(if(");
    expect(query.value.columns[0]).toMatchObject({
      name: "second__device",
      idOf: "device",
      isPairText: true,
    });
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
 * Each chart case against a real store of the version the store runs, read by a reader given the
 * module's grants and row policy, through the tables, compared with Spark's results for the
 * warehouse's own SQL on the same rows. It rebuilds the `store` database and its own reader, so it
 * runs only against a throwaway store, and skips without one:
 *
 *   docker run -d --name feed-test-clickhouse -p 127.0.0.1:18123:8123 \
 *     -e CLICKHOUSE_USER=admin -e CLICKHOUSE_PASSWORD=local -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
 *     clickhouse/clickhouse-server:25.8.33.6
 *   CLICKHOUSE_TEST_URL=http://127.0.0.1:18123 CLICKHOUSE_TEST_USER=admin CLICKHOUSE_TEST_PASSWORD=local \
 *     pnpm --filter backend exec vitest run src/common/modules/serving-store
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
    for (const statement of storeMigrationStatements()) {
      await admin.command({ query: statement });
    }
    const macroRow = (macroId: string) => (row: z.infer<typeof zRow>) => ({
      experiment_id: row.experiment ?? "charts",
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
    await createReader(admin);

    const config = new ConfigService({
      servingStore: { url, username: READER, password: READER_PASSWORD },
    });
    client = new ServingStoreClientService(new ServingStoreConfigService(config));
    adapter = new ServingStoreAdapter(client);
  });

  afterAll(async () => {
    await client.onModuleDestroy();
    await dropReader(admin);
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

  it("orders whole devices by the registry's ids, as Spark sorts their structs", async () => {
    const row = { ...emptyMacroRow("device-order"), timestamp: "2026-09-07 00:00:00" };
    await admin.insert({
      table: "macro_results",
      values: [
        { ...row, id: 1, raw_id: 1, client_id: "reg-1", device_id: "d1", device_name: "Old" },
        { ...row, id: 2, raw_id: 2, client_id: "reg-2", device_id: "d9", device_name: "Probe" },
        { ...row, id: 3, raw_id: 3, client_id: "phone-a", device_id: "d2", device_name: "Ambit" },
      ],
      format: "JSONEachRow",
    });

    const query = adapter.buildExperimentQuery({
      ...storeRead("groupedStats", "device-order"),
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [{ column: "*", function: "count" }],
      },
      ordering: { column: "device", direction: "ASC" },
      deviceSerials: [
        ["reg-1", "SN1"],
        ["reg-2", "SN2"],
      ],
      // reg-2's registry id sorts before reg-1's, the other way round from their client ids.
      orderByIds: ["reg-2", "reg-1"],
    });
    assertSuccess(query);
    const data = await adapter.executeQuery(query.value);
    assertSuccess(data);

    expect(data.value.rows.map(([device]) => device)).toEqual([
      '[null,"Ambit (d2)"]',
      '["reg-2","SN2"]',
      '["reg-1","SN1"]',
    ]);
  });

  it("runs a sum grouped first by device in the registry's order, as Spark orders the structs", async () => {
    const row = { ...emptyMacroRow("device-sums"), timestamp: "2026-09-07 00:00:00" };
    await admin.insert({
      table: "macro_results",
      values: [
        { ...row, id: 1, raw_id: 1, client_id: "reg-1", device_id: "d1", device_name: "Old" },
        { ...row, id: 2, raw_id: 2, client_id: "reg-2", device_id: "d9", device_name: "Probe" },
        { ...row, id: 3, raw_id: 3, client_id: "phone-a", device_id: "d2", device_name: "Ambit" },
      ],
      format: "JSONEachRow",
    });

    const data = await rowsOf({
      ...storeRead("groupedStats", "device-sums"),
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [{ column: "*", function: "cumsum" }],
      },
      ordering: undefined,
      deviceSerials: [
        ["reg-1", "SN1"],
        ["reg-2", "SN2"],
      ],
      // reg-2's registry id sorts before reg-1's, the other way round from their client ids.
      orderByIds: ["reg-2", "reg-1"],
    });

    expect(new Map(data.rows.map(([device, total]) => [device, total]))).toEqual(
      new Map([
        ['[null,"Ambit (d2)"]', "1"],
        ['["reg-2","SN2"]', "2"],
        ['["reg-1","SN1"]', "3"],
      ]),
    );
  });

  it("gives null for a constant series, where the warehouse fails the read", async () => {
    const row = {
      ...emptyMacroRow("constant"),
      timestamp: "2026-09-07 00:00:00",
      device_name: "A",
    };
    await admin.insert({
      table: "macro_results",
      values: [1, 2, 3].map((id) => ({
        ...row,
        id,
        raw_id: id,
        latitude: id,
        macro_output: { v: 5 },
        macro_output_text: '{"v":5}',
      })),
      format: "JSONEachRow",
    });

    const data = await rowsOf(storeRead("correlation", "constant"));

    expect(data.rows).toEqual([["A", null]]);
  });

  it("filters a chart by contributor as a page filters", async () => {
    const row = {
      ...emptyMacroRow("contributors"),
      timestamp: "2026-09-07 00:00:00",
      device_name: "A",
    };
    await admin.insert({
      table: "macro_results",
      values: [
        { ...row, id: 1, raw_id: 1, user_id: ADA },
        { ...row, id: 2, raw_id: 2, user_id: ADA },
        { ...row, id: 3, raw_id: 3, user_id: BEN, device_name: "B" },
      ],
      format: "JSONEachRow",
    });

    const data = await rowsOf({
      ...storeRead("groupedStats", "contributors"),
      aggregation: {
        groupBy: [{ column: "device_name" }],
        functions: [{ column: "*", function: "count" }],
      },
      filters: [{ column: "contributor.id", operator: "equals", value: ADA }],
    });

    expect(data.rows).toEqual([["A", "2"]]);
  });

  describe("matching a second table by time", () => {
    beforeAll(async () => {
      const primary = { ...emptyMacroRow("joined"), macro_id: "m1" };
      const second = { ...emptyMacroRow("joined"), macro_id: "m2" };
      await admin.insert({
        table: "macro_results",
        values: [
          { ...primary, id: 1, raw_id: 1, device_id: "d1", timestamp: "2026-09-07 10:00:00" },
          { ...primary, id: 2, raw_id: 2, device_id: "d2", timestamp: "2026-09-07 10:00:00" },
          { ...primary, id: 3, raw_id: 3, device_id: "d1", timestamp: "2026-09-07 08:00:00" },
          {
            ...second,
            id: 11,
            raw_id: 11,
            device_id: "d1",
            client_id: "reg-1",
            device_name: "Old",
            user_id: ADA,
            timestamp: "2026-09-07 09:30:00",
          },
          {
            ...second,
            id: 12,
            raw_id: 12,
            device_id: "d2",
            client_id: "phone-a",
            device_name: "Ambit",
            user_id: BEN,
            timestamp: "2026-09-07 09:45:00",
          },
        ],
        format: "JSONEachRow",
      });
    });

    it("reads the second table's contributor as its id and its device as its own pair", async () => {
      const data = await rowsOf(
        joinedRead({ columns: ["id", "second__contributor", "second__device"] }),
      );

      expect(data.rows).toEqual([
        ["1", ADA, '["reg-1","SN1"]'],
        ["2", BEN, '["phone-a","Ambit (d2)"]'],
        ["3", null, null],
      ]);
    });

    it("filters by the second table's device label, from that table's own names", async () => {
      const data = await rowsOf(
        joinedRead({
          columns: ["id"],
          filters: [{ column: "second__device.serial_number", operator: "equals", value: "SN1" }],
        }),
      );

      expect(data.rows).toEqual([["1"]]);
    });

    it("groups by the second table's device label", async () => {
      const data = await rowsOf(
        joinedRead({
          aggregation: {
            groupBy: [{ column: "second__device.serial_number", alias: "label" }],
            functions: [{ column: "*", function: "count" }],
          },
          ordering: { column: "label", direction: "ASC" },
        }),
      );

      expect(data.rows).toEqual([
        [null, "1"],
        ["Ambit (d2)", "1"],
        ["SN1", "1"],
      ]);
    });

    it("groups by the second table's device as null where no row matched, as the warehouse does", async () => {
      const data = await rowsOf(
        joinedRead({
          aggregation: {
            groupBy: [{ column: "second__device" }],
            functions: [{ column: "*", function: "count" }],
          },
          ordering: { column: "second__device", direction: "ASC" },
          orderByIds: ["reg-1"],
        }),
      );

      expect(data.rows).toEqual([
        [null, "1"],
        ['[null,"Ambit (d2)"]', "1"],
        ['["reg-1","SN1"]', "1"],
      ]);
    });
  });

  describe("a chart's flags and custom metadata", () => {
    const experiment = "flags-and-sheets";
    const sheet = {
      variants: [METADATA_VARIANT],
      metadataSheets: [
        { id: "s1", matchOn: "plot", schema: METADATA_VARIANT.schema, version: "1" },
      ],
    };
    // Row 1 carries the phone's flag, row 3 one added afterwards, which Postgres holds.
    const flaggedOnly = {
      flagged: { kind: "only", addedRowIds: ["3"] },
    } satisfies Partial<StoreQueryParams>;
    const countBySoil = {
      aggregation: {
        groupBy: [{ column: "soil" }],
        functions: [{ column: "*", function: "count" }],
      },
      ordering: { column: "soil", direction: "ASC" },
    } satisfies Partial<StoreQueryParams>;

    beforeAll(async () => {
      const primary = { ...emptyMacroRow(experiment), macro_id: "m1" };
      const second = { ...emptyMacroRow(experiment), macro_id: "m2" };
      const reading = (id: number, deviceId: string, timestamp: string, plot: string) => ({
        ...primary,
        id,
        raw_id: id,
        device_id: deviceId,
        timestamp,
        questions_data: { plot },
      });
      await admin.insert({
        table: "macro_results",
        values: [
          {
            ...reading(1, "d1", "2026-09-07 10:00:00", "A1"),
            annotations: [
              {
                id: "p1",
                rowId: "1",
                type: "flag",
                content: { text: null, flagType: "outlier" },
                createdBy: null,
                createdByName: null,
                createdAt: null,
                updatedAt: null,
              },
            ],
          },
          reading(2, "d2", "2026-09-07 10:00:00", "B2"),
          reading(3, "d1", "2026-09-07 11:00:00", "B2"),
          reading(4, "d2", "2026-09-07 11:00:00", "C3"),
          {
            ...second,
            id: 11,
            raw_id: 11,
            device_id: "d1",
            client_id: "reg-1",
            timestamp: "2026-09-07 09:30:00",
          },
          {
            ...second,
            id: 12,
            raw_id: 12,
            device_id: "d2",
            client_id: "phone-a",
            device_name: "Ambit",
            timestamp: "2026-09-07 09:45:00",
          },
        ],
        format: "JSONEachRow",
      });
      await admin.insert({
        table: "metadata_rows",
        values: [
          ["A1", { soil: "clay" }],
          ["B2", { soil: "sand" }],
        ].map(([identifier, fields]) => ({
          experiment_id: experiment,
          sheet_id: "s1",
          sheet_created_at: "2026-09-01 08:00:00",
          match_on: "plot",
          identifier,
          fields: JSON.stringify(fields),
          is_deleted: 0,
          _commit_version: 1,
          _commit_timestamp: "2026-09-01 08:00:01",
        })),
        format: "JSONEachRow",
      });
    });

    function chartRead(read: Partial<StoreQueryParams>): StoreQueryParams {
      return {
        tableName: "m1",
        tableType: "macro",
        experimentId: experiment,
        reservedColumns: STORE_COLUMNS,
        isChartRead: true,
        limit: CHART_LIMIT,
        ...read,
      };
    }

    it("groups a chart by a sheet's field, the rows no sheet matches as null", async () => {
      const data = await rowsOf(chartRead({ ...sheet, ...countBySoil }));

      expect(data.rows).toEqual([
        [null, "1"],
        ["clay", "1"],
        ["sand", "2"],
      ]);
    });

    it("joins the sheets under a second table matched by time, on a page and on a chart", async () => {
      const page = await rowsOf(
        joinedRead({
          experimentId: experiment,
          ...sheet,
          isChartRead: false,
          columns: ["id", "soil", "second__device"],
          limit: 10,
          offset: 0,
        }),
      );
      const chart = await rowsOf(
        joinedRead({ experimentId: experiment, ...sheet, ...countBySoil, ...flaggedOnly }),
      );

      expect(page.rows).toEqual([
        ["1", "clay", '["reg-1","SN1"]'],
        ["2", "sand", '["phone-a","Ambit (d2)"]'],
        ["3", "sand", null],
        ["4", null, null],
      ]);
      expect(chart.rows).toEqual([
        ["clay", "1"],
        ["sand", "1"],
      ]);
    });
  });

  async function rowsOf(params: StoreQueryParams) {
    const query = adapter.buildExperimentQuery(params);
    assertSuccess(query);
    const data = await adapter.executeQuery(query.value);
    assertSuccess(data);
    return data.value;
  }
});

const ADA = "0b5c5c9e-5f7a-4d0e-9a51-6b0e3c3a1f01";
const BEN = "0b5c5c9e-5f7a-4d0e-9a51-6b0e3c3a1f02";

/** A macro row of an experiment with nothing in it yet but the columns every row needs. */
function emptyMacroRow(experimentId: string) {
  return {
    experiment_id: experimentId,
    macro_id: "m1",
    macro_output: {},
    questions_data: {},
    annotations: [],
    _commit_version: 1,
    _commit_timestamp: "2026-09-07 00:00:01",
  };
}

/** A read of the joined experiment's first table matched to its second by device and time. */
function joinedRead(read: Partial<StoreQueryParams>): StoreQueryParams {
  return {
    tableName: "m1",
    tableType: "macro",
    experimentId: "joined",
    reservedColumns: STORE_COLUMNS,
    deviceSerials: [["reg-1", "SN1"]],
    isChartRead: true,
    limit: CHART_LIMIT,
    ordering: { column: "id", direction: "ASC" },
    join: {
      matchColumn: "device_id",
      toleranceMinutes: 60,
      secondary: {
        tableName: "m2",
        tableType: "macro",
        variants: MATCH_VARIANTS,
        reservedColumns: STORE_COLUMNS,
      },
      primaryColumns: STORE_COLUMNS,
      secondaryColumns: [
        { name: "contributor", alias: "second__contributor" },
        { name: "device", alias: "second__device" },
        { name: "w", alias: "w" },
      ],
      primaryTimeColumn: "timestamp",
      primaryTimeType: "TIMESTAMP",
      secondaryTimeColumn: "timestamp",
      secondaryTimeType: "TIMESTAMP",
    },
    ...read,
  };
}

/** A cell as the value Spark's result holds: numbers as numbers, anything else as its text. */
function typedCell(cell: string | null | undefined, type: string): number | string | null {
  if (cell === null || cell === undefined) {
    return null;
  }
  const isNumber = ["BIGINT", "INT", "DOUBLE"].includes(type) || type.startsWith("DECIMAL(");
  return isNumber ? Number(cell) : cell;
}

/**
 * Equal, or both NaN, or doubles apart by what their inputs' rounding allows: sums run in another
 * order, and a correlation of values far from zero is only good to about 1e-10 in either engine.
 */
function expectSameValue(actual: number | string | null, expected: number | string | null): void {
  const expectedValue = expected === "NaN" ? Number.NaN : expected;
  if (typeof actual === "number" && typeof expectedValue === "number") {
    const tolerance = 1e-9 * Math.max(1, Math.abs(expectedValue));
    const isSame =
      (Number.isNaN(actual) && Number.isNaN(expectedValue)) ||
      Math.abs(actual - expectedValue) <= tolerance;
    expect({ actual, isSame }).toEqual({ actual, isSame: true });
    return;
  }
  expect(actual).toEqual(expectedValue);
}

/** A reader of this spec's own, given the grants and row policy the module gives the store's. */
const READER = "chart_spec_reader";
const READER_PASSWORD = "chart-spec";
const READER_POLICY = "chart_spec_reader_policy";

/** The reader's access as the module's main.tf writes its locals. */
const READER_ACCESS = readerAccess();

function readerAccess(): { views: string[]; tables: string[]; rowFilter: string } {
  const main = readFileSync(resolve(MODULE, "main.tf"), "utf-8");
  const local = (name: string) => {
    const value = new RegExp(`^\\s*${name}\\s*=\\s*(\\[[^\\]]*\\]|"[^"]*")`, "m").exec(main)?.[1];
    if (value === undefined) {
      throw new Error(`main.tf no longer sets ${name}`);
    }
    return value;
  };
  const names = (list: string) => {
    const quoted: string[] = list.match(/"[^"]+"/g) ?? [];
    return quoted.map((name) => name.slice(1, -1));
  };
  return {
    views: names(local("reader_views")),
    tables: names(local("reader_tables")),
    rowFilter: local("reader_row_filter").slice(1, -1),
  };
}

async function createReader(admin: ClickHouseClient): Promise<void> {
  await dropReader(admin);
  await admin.command({ query: `CREATE USER ${READER} IDENTIFIED BY '${READER_PASSWORD}'` });
  for (const name of [...READER_ACCESS.views, ...READER_ACCESS.tables]) {
    await admin.command({ query: `GRANT SELECT ON store.${name} TO ${READER}` });
  }
  const tables = READER_ACCESS.tables.map((table) => `store.${table}`).join(", ");
  await admin.command({
    query: `CREATE ROW POLICY ${READER_POLICY} ON ${tables} USING ${READER_ACCESS.rowFilter} TO ${READER}`,
  });
}

async function dropReader(admin: ClickHouseClient): Promise<void> {
  const tables = READER_ACCESS.tables.map((table) => `store.${table}`).join(", ");
  await admin.command({ query: `DROP ROW POLICY IF EXISTS ${READER_POLICY} ON ${tables}` });
  await admin.command({ query: `DROP USER IF EXISTS ${READER}` });
}
