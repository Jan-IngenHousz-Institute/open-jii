import type { ClickHouseClient } from "@clickhouse/client";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "fs";
import { z } from "zod";

import {
  zExperimentAggregationFunction,
  zExperimentDataFilterOperator,
  zExperimentTimeBucketUnit,
  zExperimentWidthBucket,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { StoreQueryParams } from "../../../../../experiments/core/ports/serving-store.port";
import { dataFixture } from "../../../../../test/data-fixtures";
import { emptyStore, storeSetting, testStoreAdmin } from "../../../../../test/store-admin";
import { STORE_READER_ACCESS } from "../../../../../test/store-reader";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { QueryBuilderService } from "../../../databricks/services/query-builder/query-builder.service";
import type { AggregateExpression } from "../../../databricks/services/query-builder/query-builder.types";
import { ServingStoreAdapter } from "../../serving-store.adapter";
import { ServingStoreClientService } from "../client/client.service";
import { ServingStoreConfigService } from "../config/config.service";
import { MACRO_RESULTS_TABLE, MEASUREMENTS_TABLE, UPLOADS_TABLE } from "./store-tables";

const zRow = z.object({
  /** The experiment the row belongs to, when not the one most cases read. */
  experiment: z.string().optional(),
  id: z.number(),
  timestamp: z.string(),
  device_name: z.string().nullable(),
  latitude: z.number().nullable(),
  output: z.string(),
});

/** A raw data row, with its question answers as the phone sends them, all text. */
const zRawRow = z.object({
  experiment: z.string().optional(),
  id: z.number(),
  timestamp: z.string(),
  device_name: z.string().nullable(),
  latitude: z.number().nullable(),
  answers: z.record(z.string(), z.string()),
});

const zUploadRow = z.object({
  experiment: z.string().optional(),
  id: z.number(),
  uploaded_at: z.string(),
  output: z.string(),
});

const zCase = z.object({
  /** The table the case reads, a macro's when it names none. */
  table: z.enum(["macro", "raw_data", "upload"]).optional(),
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
  /** Raw data and the metadata sheet that matches its rows by their `plot` answer. */
  rawData: z.object({
    questionsSchema: z.string(),
    metadataSchema: z.string(),
    sheet: z.array(z.object({ identifier: z.string(), fields: z.string() })),
    rows: z.array(zRawRow),
  }),
  uploads: z.object({ schema: z.string(), rows: z.array(zUploadRow) }),
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

const FIXTURE = zFixture.parse(JSON.parse(readFileSync(dataFixture("chart-parity.json"), "utf-8")));

/** The columns the Spark test's view holds, as the warehouse's macro view holds them. */
const SPARK_COLUMNS = ["experiment_id", "id", "timestamp", "date", "device_name", "latitude"];

const STORE_COLUMNS = MACRO_RESULTS_TABLE.columns
  .map(({ name }) => name)
  .filter((name) => name !== "macro_output");

const VARIANTS = [{ columnName: "macro_output", schema: FIXTURE.schema, suffix: "output" }];

/** The sheet the Spark test folds into each raw row's custom metadata, as gold does. */
const RAW_SHEETS = [
  { id: "s1", matchOn: "plot", schema: FIXTURE.rawData.metadataSchema, version: "1" },
];

/**
 * Each table a case reads: the store's, and the Spark test's view of it with the columns it holds
 * beside its payloads, which the payloads' fields are named around.
 */
const TABLES = {
  macro: {
    store: { tableName: "m1", tableType: "macro" },
    storeColumns: STORE_COLUMNS,
    view: "chart_rows",
    viewColumns: SPARK_COLUMNS,
    variants: VARIANTS,
    metadataSheets: undefined,
  },
  raw_data: {
    store: { tableName: "raw_data", tableType: "static" },
    storeColumns: MEASUREMENTS_TABLE.columns
      .map(({ name }) => name)
      .filter((name) => name !== "questions_data" && name !== "custom_metadata"),
    view: "chart_raw_rows",
    viewColumns: SPARK_COLUMNS,
    variants: [
      {
        columnName: "questions_data",
        schema: FIXTURE.rawData.questionsSchema,
        suffix: "answer",
      },
      {
        columnName: "custom_metadata",
        schema: FIXTURE.rawData.metadataSchema,
        suffix: "metadata",
      },
    ],
    metadataSheets: RAW_SHEETS,
  },
  upload: {
    store: { tableName: "t1", tableType: "upload" },
    storeColumns: UPLOADS_TABLE.columns
      .map(({ name }) => name)
      .filter((name) => name !== "uploaded_data"),
    view: "chart_uploads",
    viewColumns: ["experiment_id", "id", "uploaded_at"],
    variants: [{ columnName: "uploaded_data", schema: FIXTURE.uploads.schema, suffix: "upload" }],
    metadataSheets: undefined,
  },
} satisfies Record<
  NonNullable<z.infer<typeof zCase>["table"]>,
  Pick<StoreQueryParams, "variants" | "metadataSheets"> & {
    store: Pick<StoreQueryParams, "tableName" | "tableType">;
    storeColumns: string[];
    view: string;
    viewColumns: string[];
  }
>;
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
  const { table, columns, join, filters, aggregation, ordering, limit } = FIXTURE.cases[name];
  const read = TABLES[table ?? "macro"];
  return {
    ...read.store,
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
    variants: read.variants,
    reservedColumns: read.storeColumns,
    metadataSheets: read.metadataSheets,
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
    table,
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
    const read = TABLES[table ?? "macro"];
    const built = service.buildQuery({
      table: read.view,
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
      variants: read.variants,
      reservedColumns: read.viewColumns,
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
    dataFixture("chart-queries.json"),
  );
});

describe("StoreAggregation", () => {
  const adapter = new ServingStoreAdapter(
    new ServingStoreClientService(new ServingStoreConfigService(new ConfigService({}))),
  );

  it("reads the tables with FINAL in every chart statement, never the views but the sheets'", () => {
    // A table read without FINAL, its alias, if any, coming first.
    const unmerged = /\b(?:measurements|macro_results|uploads)\b(?!(?: AS \w+)? FINAL\b)/;
    for (const name of Object.keys(FIXTURE.cases)) {
      const query = adapter.buildExperimentQuery(storeRead(name));
      assertSuccess(query);

      // The reader reads a sheet's rows through their view alone.
      const readsView = /\bexperiment_(?!metadata_rows\()\w+\(/.test(query.value.sql);
      expect({ name, readsView }).toEqual({ name, readsView: false });
      expect({ name, unmerged: unmerged.exec(query.value.sql)?.[0] }).toEqual({
        name,
        unmerged: undefined,
      });
      expect(query.value.experiment).toBe(FIXTURE.cases[name].experiment ?? "charts");
    }
  });

  it("keeps every read of a table to its experiment in its own statement, in a chart and a page", () => {
    const sheet = {
      variants: [METADATA_VARIANT],
      metadataSheets: [
        { id: "s1", matchOn: "plot", schema: METADATA_VARIANT.schema, version: "1" },
      ],
    } satisfies Partial<StoreQueryParams>;
    const charts = Object.keys(FIXTURE.cases).map((name) => storeRead(name));
    const others: StoreQueryParams[] = [
      decimalRead({ groupBy: [{ column: "area" }] }),
      { ...decimalRead(undefined), columns: ["id", "area"], ordering: { column: "id" }, limit: 5 },
      joinedRead({ ...sheet, columns: ["id", "soil", "second__device"] }),
      joinedRead({ ...sheet, isChartRead: false, columns: ["id", "soil"], limit: 10, offset: 0 }),
      joinedRead({ flagged: { kind: "only", addedRowIds: ["3"] }, columns: ["id"] }),
    ];

    for (const read of [...charts, ...others]) {
      const query = adapter.buildExperimentQuery(read);
      assertSuccess(query);

      for (const sql of [query.value.sql, adapter.countQuery(query.value).sql]) {
        expect(unscopedTableReads(sql, read.experimentId)).toEqual([]);
      }
    }
  });

  it("adds up wider than Spark's sum and fails past its type, as Spark's ANSI mode does", () => {
    const sums = adapter.buildExperimentQuery(storeRead("groupedStats"));
    const running = adapter.buildExperimentQuery(storeRead("rowCumsum"));
    const decimals = adapter.buildExperimentQuery(
      decimalRead({ functions: [{ column: "area", function: "sum" }] }),
    );

    assertSuccess(sums);
    assertSuccess(running);
    assertSuccess(decimals);
    const longSum = "sum(toNullable(toInt128(`n`)))";
    expect(sums.value.sql).toContain(
      `if(throwIf(${longSum} IS NOT NULL AND accurateCastOrNull(${longSum}, 'Int64') IS NULL, `,
    );
    expect(running.value.sql).toContain("sum(toNullable(toInt128(`n`))) OVER (ORDER BY ");
    expect(running.value.sql).toContain("throwIf(");
    // DECIMAL(22,2) sums as DECIMAL(32,2), which holds 30 whole digits.
    expect(decimals.value.sql).toContain(
      `ifNull(abs(sum(toNullable(toDecimal256(\`area\`, 2)))) >= toDecimal256('1${"0".repeat(30)}', 0), 0)`,
    );
  });

  it("adds up text as the double it holds and fails on text that holds none, as Spark's ANSI mode does", () => {
    const query = adapter.buildExperimentQuery({
      ...storeRead("groupedStats"),
      aggregation: {
        functions: [
          { column: "device_name", function: "sum" },
          { column: "device_name", function: "avg" },
        ],
      },
      ordering: undefined,
    });

    assertSuccess(query);
    expect(query.value.columns).toEqual([
      { name: "device_name_sum", type: "DOUBLE" },
      { name: "device_name_avg", type: "DOUBLE" },
    ]);
    const number = "toNullable(if(throwIf(`device_name` IS NOT NULL AND toFloat64OrNull(";
    expect(query.value.sql).toContain(`sum(${number}`);
    expect(query.value.sql).toContain(`avg(${number}`);
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

  it("types a decimal's sum and mean as Spark does, and writes them as text at that scale", () => {
    const query = adapter.buildExperimentQuery(
      decimalRead({
        functions: [
          { column: "area", function: "sum" },
          { column: "area", function: "avg" },
        ],
      }),
    );

    assertSuccess(query);
    expect(query.value.columns).toEqual([
      { name: "area_sum", type: "DECIMAL(32,2)" },
      { name: "area_avg", type: "DECIMAL(26,6)" },
    ]);
    expect(query.value.sql).toMatch(
      /^SELECT toDecimalString\(`area_sum`, 2\) AS `area_sum`, toDecimalString\(`area_avg`, 6\) AS `area_avg`/,
    );
    expect(query.value.sql).not.toContain("avg(");
  });

  it("types a running sum of decimals grouped first as Spark types a sum of sums", () => {
    const query = adapter.buildExperimentQuery(
      decimalRead({
        groupBy: [{ column: "timestamp", timeBucket: "day" }],
        functions: [{ column: "area", function: "cumsum" }],
      }),
    );

    assertSuccess(query);
    expect(query.value.columns.at(-1)).toEqual({ name: "area_cumsum", type: "DECIMAL(38,2)" });
  });

  it("types a decimal's change from the previous row with a digit more, as Spark subtracts", () => {
    const query = adapter.buildExperimentQuery({
      ...decimalRead({ functions: [DECIMAL_CHANGE] }),
      columns: ["id"],
    });

    assertSuccess(query);
    expect(query.value.columns.at(-1)).toEqual({
      name: "area_change_from_previous",
      type: "DECIMAL(23,2)",
    });
    expect(query.value.sql).toContain(
      "toDecimalString(`area_change_from_previous`, 2) AS `area_change_from_previous`",
    );
  });

  it("groups and counts a double's NaNs as one and -0.0 as 0.0, as Spark does, and sorts the groups it gives", () => {
    const query = adapter.buildExperimentQuery({
      ...storeRead("groupedStats"),
      aggregation: {
        groupBy: [{ column: "latitude" }],
        functions: [{ column: "v", function: "count_distinct" }],
      },
      ordering: { column: "latitude", direction: "ASC" },
    });

    assertSuccess(query);
    const key = (name: string) =>
      `multiIf(isNaN(\`${name}\`), nan, \`${name}\` = 0, 0.0, \`${name}\`)`;
    expect(query.value.sql).toContain(`SELECT ${key("latitude")} AS \`latitude\``);
    expect(query.value.sql).toContain(`count(DISTINCT ${key("v")})`);
    expect(query.value.sql).toContain(
      `GROUP BY ${key("latitude")}) ORDER BY isNaN(\`latitude\`) ASC NULLS FIRST, \`latitude\` ASC NULLS FIRST`,
    );
  });

  it("correlates a pair holding NaN or an infinity to NaN, as Spark does", () => {
    const query = adapter.buildExperimentQuery(storeRead("correlation"));

    assertSuccess(query);
    expect(query.value.sql).toContain(
      "multiIf(countIf(`v` IS NOT NULL AND `latitude` IS NOT NULL AND (NOT isFinite(`v`) OR NOT isFinite(`latitude`))) > 0, nan, ",
    );
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

  it("picks and lags a device or an array as its JSON text, which the store can leave null", () => {
    const along = { orderColumn: "timestamp", tieBreaker: "id" };
    const picks = adapter.buildExperimentQuery({
      ...storeRead("groupedStats"),
      aggregation: {
        groupBy: [{ column: "device_name" }],
        functions: [
          { column: "device", function: "latest", ...along },
          { column: "annotations", function: "earliest", ...along },
        ],
      },
    });
    const lags = adapter.buildExperimentQuery({
      ...storeRead("rowWindows"),
      columns: ["id"],
      aggregation: {
        functions: [
          { column: "device", function: "previous", ...along },
          { column: "annotations", function: "previous", ...along },
        ],
      },
    });

    assertSuccess(picks);
    assertSuccess(lags);
    expect(picks.value.sql).toContain("argMaxIf(tuple(toNullable(toJSONString(`device`))), ");
    expect(picks.value.sql).toContain("argMinIf(tuple(toNullable(toJSONString(`annotations`))), ");
    expect(lags.value.sql).toContain("lagInFrame(toNullable(toJSONString(`device`))) OVER");
    expect(lags.value.sql).toContain("lagInFrame(toNullable(toJSONString(`annotations`))) OVER");
    const pairText = { idOf: "device", isPairText: true };
    expect(picks.value.columns.find(({ name }) => name === "device_latest")).toMatchObject(
      pairText,
    );
    expect(lags.value.columns.find(({ name }) => name === "device_previous")).toMatchObject(
      pairText,
    );
  });

  it("reads from the table only what a chart's groups, functions, sort and shown columns use", () => {
    const counted = adapter.buildExperimentQuery({
      ...storeRead("rawAnswerStats"),
      aggregation: { functions: [{ column: "*", function: "count" }] },
      ordering: undefined,
    });
    const grouped = adapter.buildExperimentQuery(storeRead("rawAnswerStats"));
    const windows = adapter.buildExperimentQuery({ ...storeRead("rowWindows"), columns: ["id"] });
    const labels = adapter.buildExperimentQuery({
      ...storeRead("groupedStats"),
      aggregation: {
        groupBy: [{ column: "device.serial_number", alias: "label" }],
        functions: [{ column: "*", function: "count" }],
      },
      ordering: undefined,
    });
    const everyColumn = adapter.buildExperimentQuery(storeRead("rowCumsum"));

    assertSuccess(counted);
    assertSuccess(grouped);
    assertSuccess(windows);
    assertSuccess(labels);
    assertSuccess(everyColumn);
    expect(counted.value.sql).not.toContain("questions_data[");
    expect(counted.value.sql).not.toContain("experiment_metadata_rows");
    expect(grouped.value.sql).toContain("questions_data['plot'] AS `plot`");
    expect(grouped.value.sql).not.toContain("experiment_metadata_rows");
    expect(windows.value.sql).not.toContain("macro_output.`n`");
    expect(windows.value.sql).not.toContain("latitude AS `latitude`");
    expect(windows.value.sql).toContain("timestamp AS `timestamp`");
    expect(labels.value.sql).toContain(" AS `device`");
    expect(labels.value.sql).not.toContain("macro_output.`v`");
    // A read that keeps its rows and names no columns shows every one.
    expect(everyColumn.value.sql).toContain("latitude AS `latitude`");
  });

  it("returns only a chart's columns beside its windows", () => {
    const query = adapter.buildExperimentQuery({ ...storeRead("rowWindows"), columns: ["id"] });

    assertSuccess(query);
    expect(query.value.columns.map(({ name }) => name)).toEqual(FIXTURE.cases.rowWindows.compare);
    expect(query.value.sql).toContain("PARTITION BY `device_name` ORDER BY `timestamp`");
  });

  it("returns a path into a device or a contributor beside a chart's windows as Spark names its field", () => {
    const query = adapter.buildExperimentQuery({
      ...storeRead("rowWindows"),
      columns: ["device.serial_number", "id"],
    });
    const contributor = adapter.buildExperimentQuery({
      ...storeRead("rowWindows"),
      columns: ["contributor.id"],
    });
    const unheld = adapter.buildExperimentQuery({
      ...storeRead("rowWindows"),
      columns: ["id", "contributor.name"],
    });

    assertSuccess(query);
    assertSuccess(contributor);
    expect(query.value.columns.slice(0, 2)).toEqual([
      { name: "serial_number", type: "STRING" },
      expect.objectContaining({ name: "id", type: "BIGINT" }),
    ]);
    expect(query.value.sql).toMatch(
      /^SELECT tupleElement\(`device`, 2\) AS `serial_number`, toString\(`id`\) AS `id`, /,
    );
    expect(contributor.value.columns[0]).toEqual({ name: "id", type: "STRING" });
    expect(contributor.value.sql).toMatch(/^SELECT `contributor` AS `id`, /);
    assertFailure(unheld);
    expect(unheld.error.code).toBe("INVALID_QUERY_INPUT");
  });

  it("gives contributors who share a name one place in an aggregate's sort, as Spark ties them", () => {
    const query = adapter.buildExperimentQuery({
      ...storeRead("groupedStats"),
      aggregation: {
        groupBy: [{ column: "contributor" }],
        functions: [{ column: "*", function: "count" }],
      },
      ordering: { column: "contributor.name", direction: "ASC" },
      orderByIds: [[BEN], [ADA, "u3"]],
    });

    assertSuccess(query);
    expect(query.value.sql).toContain("CAST([1, 2, 2] AS Array(UInt32)) AS __order_ranks");
    expect(query.value.sql).toContain(
      "ORDER BY arrayElement(__order_ranks, indexOf(__order_ids, `contributor`)) ASC NULLS FIRST",
    );
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
 * warehouse's own SQL on the same rows, on the test store `pnpm test` starts and migrates, which it
 * seeds and empties as its admin.
 */
const STORE_URL = storeSetting("SERVING_STORE_URL");

describe("StoreAggregation against a store", () => {
  let results: z.infer<typeof zResults>;
  let admin: ClickHouseClient;
  let client: ServingStoreClientService;
  let adapter: ServingStoreAdapter;

  beforeAll(async () => {
    results = zResults.parse(JSON.parse(readFileSync(dataFixture("chart-results.json"), "utf-8")));
    const url = STORE_URL;
    admin = testStoreAdmin({ json_type_escape_dots_in_keys: 1 });
    await emptyStore(admin);
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
    await admin.insert({
      table: "measurements",
      values: FIXTURE.rawData.rows.map((row) => ({
        experiment_id: row.experiment ?? "charts",
        id: row.id,
        timestamp: row.timestamp,
        device_name: row.device_name,
        latitude: row.latitude,
        questions_data: row.answers,
        annotations: [],
        _commit_version: 1,
        _commit_timestamp: "2027-01-02 00:00:00",
      })),
      format: "JSONEachRow",
    });
    await admin.insert({
      table: "metadata_rows",
      values: FIXTURE.rawData.sheet.map(({ identifier, fields }) =>
        metadataRow("charts", identifier, fields),
      ),
      format: "JSONEachRow",
    });
    await admin.insert({
      table: "uploads",
      values: FIXTURE.uploads.rows.map((row) => ({
        experiment_id: row.experiment ?? "charts",
        id: row.id,
        upload_table_id: "t1",
        upload_table_name: "Soil samples",
        upload_id: "u1",
        uploaded_at: row.uploaded_at,
        uploaded_data: z.record(z.string(), z.unknown()).parse(JSON.parse(row.output)),
        uploaded_data_text: row.output,
        _commit_version: 1,
        _commit_timestamp: "2027-01-02 00:00:00",
      })),
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
    await emptyStore(admin);
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

  it("returns Spark's row windows beside only the columns a chart names", async () => {
    const expected = results.rowWindows;
    const data = await rowsOf({ ...storeRead("rowWindows"), columns: ["id"] });

    expect(data.columns.map(({ name }) => name)).toEqual(expected.columns);
    expect(data.rows).toHaveLength(expected.rows.length);
    data.rows.forEach((row, rowIndex) =>
      row.forEach((cell, index) =>
        expectSameValue(typedCell(cell, expected.types[index]), expected.rows[rowIndex][index]),
      ),
    );
  });

  it("returns a device's label beside a chart's windows, in the chart's order, as Spark names it", async () => {
    const row = emptyMacroRow("device-paths");
    await admin.insert({
      table: "macro_results",
      values: [
        {
          ...row,
          id: 1,
          raw_id: 1,
          timestamp: "2026-09-07 10:00:00",
          client_id: "reg-1",
          device_id: "d1",
          device_name: "Old",
        },
        {
          ...row,
          id: 2,
          raw_id: 2,
          timestamp: "2026-09-07 11:00:00",
          client_id: "phone-a",
          device_id: "d2",
          device_name: "Ambit",
        },
      ],
      format: "JSONEachRow",
    });

    const data = await rowsOf({
      ...storeRead("rowWindows", "device-paths"),
      columns: ["id", "device.serial_number"],
      aggregation: {
        functions: [
          {
            column: "*",
            function: "row_number",
            alias: "row",
            orderColumn: "timestamp",
            tieBreaker: "id",
          },
        ],
      },
      deviceSerials: [["reg-1", "SN1"]],
    });

    expect(data.columns.map(({ name }) => name)).toEqual(["id", "serial_number", "row"]);
    expect(data.rows).toEqual([
      ["1", "SN1", "1"],
      ["2", "Ambit (d2)", "2"],
    ]);
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
      orderByIds: [["reg-2"], ["reg-1"]],
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
      orderByIds: [["reg-2"], ["reg-1"]],
    });

    expect(new Map(data.rows.map(([device, total]) => [device, total]))).toEqual(
      new Map([
        ['[null,"Ambit (d2)"]', "1"],
        ['["reg-2","SN2"]', "2"],
        ['["reg-1","SN1"]', "3"],
      ]),
    );
  });

  describe("ids past 2^53", () => {
    // Inserted as SQL, since JSON from JavaScript would round them to doubles.
    beforeAll(async () => {
      const rows = [
        ["overflow", "9223372036854775807", "1"],
        ["overflow", "1", "2"],
        ["wide-buckets", "5000000000000000000", "1"],
      ].map(
        ([experiment, id, rawId]) =>
          `('${experiment}', ${id}, ${rawId}, '2026-09-07 00:00:00', 'm1', 1, '2026-09-07 00:00:01')`,
      );
      await admin.command({
        query: `INSERT INTO macro_results (experiment_id, id, raw_id, timestamp, macro_id, _commit_version, _commit_timestamp) VALUES ${rows.join(", ")}`,
      });
    });

    it("fails a sum that passes a BIGINT, as Spark's ANSI mode does, where the store would wrap", async () => {
      const sum = {
        aggregation: { functions: [{ column: "id", function: "sum" }] },
      } satisfies Partial<StoreQueryParams>;
      const running = {
        aggregation: { functions: [{ column: "id", function: "cumsum" }] },
        ordering: { column: "raw_id", direction: "ASC" },
      } satisfies Partial<StoreQueryParams>;

      for (const read of [sum, running]) {
        const query = adapter.buildExperimentQuery({
          ...storeRead("groupedStats", "overflow"),
          ordering: undefined,
          ...read,
        });
        assertSuccess(query);
        assertFailure(await adapter.executeQuery(query.value));
      }
    });

    it("keeps a fractional bucket past a BIGINT as Spark's decimal", async () => {
      const data = await rowsOf({
        ...storeRead("groupedStats", "wide-buckets"),
        aggregation: {
          groupBy: [
            {
              column: "id",
              alias: "bucket",
              widthBucket: { origin: 0, width: 0.5, scale: "number" },
            },
          ],
          functions: [{ column: "*", function: "count" }],
        },
        ordering: undefined,
      });

      expect(data.columns.map(({ type_text }) => type_text)).toEqual(["DECIMAL(22,0)", "BIGINT"]);
      expect(data.rows).toEqual([["10000000000000000000", "1"]]);
    });
  });

  it("groups and counts NaNs as one and -0.0 with 0.0, and correlates a pair holding NaN to NaN, as Spark does", async () => {
    // Inserted as SQL, since JSON from JavaScript writes -0.0 as 0 and holds no NaN. The two NaNs
    // differ in their sign bit.
    const rows = [
      ["1", "-0.0", "1"],
      ["2", "0.0", "nan"],
      ["3", "5", "6"],
      ["4", "nan", "7"],
      ["5", "-nan", "8"],
    ].map(
      ([id, latitude, longitude]) =>
        `('signed-zeros', ${id}, ${id}, '2026-09-07 00:00:00', 'm1', 'A', ${latitude}, ${longitude}, 1, '2026-09-07 00:00:01')`,
    );
    await admin.command({
      query: `INSERT INTO macro_results (experiment_id, id, raw_id, timestamp, macro_id, device_name, latitude, longitude, _commit_version, _commit_timestamp) VALUES ${rows.join(", ")}`,
    });
    const read = storeRead("groupedStats", "signed-zeros");

    const groups = await rowsOf({
      ...read,
      aggregation: {
        groupBy: [{ column: "latitude" }],
        functions: [{ column: "*", function: "count" }],
      },
      ordering: { column: "latitude", direction: "ASC" },
    });
    const counts = await rowsOf({
      ...read,
      aggregation: {
        functions: [
          { column: "latitude", function: "count_distinct" },
          { column: "latitude", function: "corr", secondColumn: "longitude" },
        ],
      },
      ordering: undefined,
    });

    expect(groups.rows).toEqual([
      ["0.0", "2"],
      ["5.0", "1"],
      ["NaN", "2"],
    ]);
    expect(counts.rows).toEqual([["3", "NaN"]]);
  });

  it("adds up text that holds numbers as Spark casts it, and fails on text that holds none", async () => {
    const row = (experiment: string, id: number, deviceName: string) => ({
      ...emptyMacroRow(experiment),
      id,
      raw_id: id,
      timestamp: "2026-09-07 00:00:00",
      device_name: deviceName,
    });
    await admin.insert({
      table: "macro_results",
      values: [
        row("number-text", 1, "1.5"),
        row("number-text", 2, "2.5"),
        row("word-text", 1, "1.5"),
        row("word-text", 2, "abc"),
      ],
      format: "JSONEachRow",
    });
    const sums = {
      aggregation: {
        functions: [
          { column: "device_name", function: "sum" },
          { column: "device_name", function: "avg" },
        ],
      },
      ordering: undefined,
    } satisfies Partial<StoreQueryParams>;

    const numbers = await rowsOf({ ...storeRead("groupedStats", "number-text"), ...sums });
    const words = adapter.buildExperimentQuery({
      ...storeRead("groupedStats", "word-text"),
      ...sums,
    });

    expect(numbers.rows).toEqual([["4.0", "2.0"]]);
    assertSuccess(words);
    assertFailure(await adapter.executeQuery(words.value));
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

  it("picks and lags a device and an array as Spark does, null where there is none", async () => {
    const experiment = "device-picks";
    const row = emptyMacroRow(experiment);
    await admin.insert({
      table: "macro_results",
      values: [
        {
          ...row,
          id: 1,
          raw_id: 1,
          timestamp: "2026-09-07 10:00:00",
          client_id: "reg-1",
          device_id: "d1",
          device_name: "Old",
        },
        {
          ...row,
          id: 2,
          raw_id: 2,
          timestamp: "2026-09-07 11:00:00",
          client_id: "phone-a",
          device_id: "d2",
          device_name: "Ambit",
        },
      ],
      format: "JSONEachRow",
    });
    const along = { orderColumn: "timestamp", tieBreaker: "id" };
    const read = {
      ...storeRead("groupedStats", experiment),
      ordering: { column: "id", direction: "ASC" },
      deviceSerials: [["reg-1", "SN1"]],
    } satisfies StoreQueryParams;

    const picks = await rowsOf({
      ...read,
      aggregation: {
        functions: [
          { column: "device", function: "latest", ...along },
          { column: "annotations", function: "earliest", ...along },
        ],
      },
      ordering: undefined,
    });
    const lags = await rowsOf({
      ...read,
      columns: ["id"],
      aggregation: {
        functions: [{ column: "device", function: "previous", alias: "before", ...along }],
      },
    });

    expect(picks.rows).toEqual([['[null,"Ambit (d2)"]', "[]"]]);
    expect(lags.rows).toEqual([
      ["1", null],
      ["2", '["reg-1","SN1"]'],
    ]);
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
          orderByIds: [["reg-1"]],
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

    it("counts only the flagged rows, or only the rest, under the reader's row policy", async () => {
      const count = {
        aggregation: { functions: [{ column: "*", function: "count" }] },
      } satisfies Partial<StoreQueryParams>;

      const flagged = await rowsOf(chartRead({ ...count, ...flaggedOnly }));
      const unflagged = await rowsOf(
        chartRead({ ...count, flagged: { kind: "exclude", addedRowIds: ["3"] } }),
      );

      expect(flagged.rows).toEqual([["2"]]);
      expect(unflagged.rows).toEqual([["2"]]);
    });

    it("runs a running sum over the flagged rows it keeps first", async () => {
      const data = await rowsOf(
        chartRead({
          ...flaggedOnly,
          aggregation: { functions: [{ column: "*", function: "cumsum", alias: "running" }] },
          ordering: { column: "timestamp", direction: "ASC" },
          limit: 10,
        }),
      );

      const id = data.columns.findIndex(({ name }) => name === "id");
      const running = data.columns.findIndex(({ name }) => name === "running");
      expect(data.rows.map((row) => [row[id], row[running]])).toEqual([
        ["1", "1"],
        ["3", "2"],
      ]);
    });

    it("matches a flagged chart's second table by time to the flagged rows only", async () => {
      const data = await rowsOf(
        joinedRead({ experimentId: experiment, columns: ["id", "second__device"], ...flaggedOnly }),
      );

      expect(data.rows).toEqual([
        ["1", '["reg-1","SN1"]'],
        ["3", null],
      ]);
    });

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

  it("matches a second table by time on a sheet's field it does not show", async () => {
    const experiment = "sheet-match";
    const reading = (macroId: string, id: number, timestamp: string, plot: string) => ({
      ...emptyMacroRow(experiment),
      macro_id: macroId,
      id,
      raw_id: id,
      timestamp,
      questions_data: { plot },
    });
    await admin.insert({
      table: "macro_results",
      values: [
        reading("m1", 1, "2026-09-07 10:00:00", "A1"),
        reading("m1", 2, "2026-09-07 10:00:00", "B2"),
        reading("m2", 11, "2026-09-07 09:30:00", "A1"),
        reading("m2", 12, "2026-09-07 09:50:00", "C3"),
      ],
      format: "JSONEachRow",
    });
    await admin.insert({
      table: "metadata_rows",
      values: [
        metadataRow(experiment, "A1", '{"soil":"clay"}'),
        metadataRow(experiment, "B2", '{"soil":"sand"}'),
      ],
      format: "JSONEachRow",
    });

    const data = await rowsOf({
      tableName: "m1",
      tableType: "macro",
      experimentId: experiment,
      reservedColumns: STORE_COLUMNS,
      variants: [METADATA_VARIANT],
      metadataSheets: [
        { id: "s1", matchOn: "plot", schema: METADATA_VARIANT.schema, version: "1" },
      ],
      columns: ["id", "matched_id"],
      ordering: { column: "id", direction: "ASC" },
      isChartRead: true,
      limit: CHART_LIMIT,
      join: {
        matchColumn: "soil",
        toleranceMinutes: 60,
        secondary: {
          tableName: "m2",
          tableType: "macro",
          variants: [METADATA_VARIANT],
          reservedColumns: STORE_COLUMNS,
        },
        primaryColumns: STORE_COLUMNS,
        secondaryColumns: [{ name: "id", alias: "matched_id" }],
        primaryTimeColumn: "timestamp",
        primaryTimeType: "TIMESTAMP",
        secondaryTimeColumn: "timestamp",
        secondaryTimeType: "TIMESTAMP",
      },
    });

    expect(data.rows).toEqual([
      ["1", "11"],
      ["2", null],
    ]);
  });

  it("matches a second table by time on -0.0 and 0.0 as one key, as Spark does", async () => {
    // Inserted as SQL, since JSON from JavaScript writes -0.0 as 0.
    const rows = [
      ["m1", "1", "-0.0", "10:00"],
      ["m1", "2", "0.0", "10:00"],
      ["m2", "11", "0.0", "09:30"],
    ].map(
      ([macroId, id, latitude, time]) =>
        `('signed-keys', ${id}, ${id}, '2026-09-07 ${time}:00', '${macroId}', ${latitude}, 1, '2026-09-07 00:00:01')`,
    );
    await admin.command({
      query: `INSERT INTO macro_results (experiment_id, id, raw_id, timestamp, macro_id, latitude, _commit_version, _commit_timestamp) VALUES ${rows.join(", ")}`,
    });

    const data = await rowsOf({
      ...storeRead("timeMatchedRows", "signed-keys"),
      columns: ["id", "matched_id"],
      join: {
        matchColumn: "latitude",
        toleranceMinutes: 60,
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
    });

    expect(data.rows).toEqual([
      ["1", "11"],
      ["2", "11"],
    ]);
  });

  it("sorts by a renamed group's own column, as Spark sorts by the group", async () => {
    const experiment = "aliased-groups";
    await admin.insert({
      table: "macro_results",
      values: ["A", "B", "A"].map((deviceName, index) => ({
        ...emptyMacroRow(experiment),
        id: index + 1,
        raw_id: index + 1,
        timestamp: "2026-09-07 10:00:00",
        device_name: deviceName,
      })),
      format: "JSONEachRow",
    });

    const data = await rowsOf({
      ...storeRead("groupedStats", experiment),
      aggregation: {
        groupBy: [{ column: "device_name", alias: "the_device" }],
        functions: [{ column: "*", function: "count" }],
      },
      ordering: { column: "device_name", direction: "DESC" },
    });

    expect(data.columns.map(({ name }) => name)).toEqual(["the_device", "count_count"]);
    expect(data.rows).toEqual([
      ["B", "1"],
      ["A", "2"],
    ]);
  });

  it("sorts by a bucket's name where the rows hold a field of that name too", async () => {
    const experiment = "hour-names";
    await admin.insert({
      table: "macro_results",
      values: ["08:15", "09:30", "09:45"].map((time, index) => ({
        ...emptyMacroRow(experiment),
        id: index + 1,
        raw_id: index + 1,
        timestamp: `2026-09-07 ${time}:00`,
        macro_output: { timestamp_hour: `text ${index}` },
        macro_output_text: `{"timestamp_hour":"text ${index}"}`,
      })),
      format: "JSONEachRow",
    });

    const data = await rowsOf({
      tableName: "m1",
      tableType: "macro",
      experimentId: experiment,
      reservedColumns: STORE_COLUMNS,
      variants: [
        { columnName: "macro_output", schema: "OBJECT<timestamp_hour: STRING>", suffix: "output" },
      ],
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: "hour" }],
        functions: [{ column: "*", function: "count" }],
      },
      ordering: { column: "timestamp_hour", direction: "DESC" },
      isChartRead: true,
      limit: CHART_LIMIT,
    });

    expect(data.rows).toEqual([
      ["2026-09-07T09:00:00.000Z", "2"],
      ["2026-09-07T08:00:00.000Z", "1"],
    ]);
  });

  describe("the mean of a sheet's decimals", () => {
    /** Rows matching the sheet rows of `values` by plot, `counts[i]` rows for the i-th value. */
    async function seed(experimentId: string, values: string[], counts: number[]) {
      const rows = values.flatMap((_, index) =>
        Array.from({ length: counts[index] }, () => `P${index}`),
      );
      await admin.insert({
        table: "macro_results",
        values: rows.map((plot, index) => ({
          ...emptyMacroRow(experimentId),
          id: index + 1,
          raw_id: index + 1,
          timestamp: "2026-09-07 10:00:00",
          questions_data: { plot },
        })),
        format: "JSONEachRow",
      });
      await admin.insert({
        table: "metadata_rows",
        values: values.map((value, index) =>
          metadataRow(experimentId, `P${index}`, `{"v":${value}}`),
        ),
        format: "JSONEachRow",
      });
    }

    function meanRead(experimentId: string, schema: string): StoreQueryParams {
      return {
        tableName: "m1",
        tableType: "macro",
        experimentId,
        reservedColumns: STORE_COLUMNS,
        variants: [{ columnName: "custom_metadata", schema, suffix: "metadata" }],
        metadataSheets: [{ id: "s1", matchOn: "plot", schema, version: "1" }],
        aggregation: { functions: [{ column: "v", function: "avg" }] },
        isChartRead: true,
        limit: CHART_LIMIT,
      };
    }

    async function meanOf(experimentId: string, schema: string) {
      return rowsOf(meanRead(experimentId, schema));
    }

    it("fails a mean its own type cannot hold, as Spark's ANSI mode does", async () => {
      // DECIMAL(38,34) averages as DECIMAL(38,38), which holds no whole digit.
      const schema = "OBJECT<v: DECIMAL(38,34)>";
      await seed("mean-past-type", ["1.2"], [1]);
      await seed("mean-in-type", ["0.5"], [1]);

      const past = adapter.buildExperimentQuery(meanRead("mean-past-type", schema));
      const within = await meanOf("mean-in-type", schema);

      assertSuccess(past);
      assertFailure(await adapter.executeQuery(past.value));
      expect(within.columns[0].type_text).toBe("DECIMAL(38,38)");
      expect(within.rows).toEqual([[`0.5${"0".repeat(37)}`]]);
    });

    it("divides once, at the mean's own scale, as Spark does", async () => {
      await seed("mean-thirds", ["0", "1"], [2, 1]);
      await seed("mean-pennies", ["0.00", "0.50"], [100, 1]);

      const thirds = await meanOf("mean-thirds", "OBJECT<v: DECIMAL(32,6)>");
      const pennies = await meanOf("mean-pennies", "OBJECT<v: DECIMAL(22,2)>");

      expect(thirds.columns[0].type_text).toBe("DECIMAL(36,10)");
      expect(thirds.rows).toEqual([["0.3333333333"]]);
      expect(pennies.columns[0].type_text).toBe("DECIMAL(26,6)");
      expect(pennies.rows).toEqual([["0.004950"]]);
    });
  });

  describe("a chart of a sheet's decimals", () => {
    beforeAll(async () => {
      const row = emptyMacroRow("decimals");
      await admin.insert({
        table: "macro_results",
        values: [
          {
            ...row,
            id: 1,
            raw_id: 1,
            timestamp: "2026-09-07 10:00:00",
            questions_data: { plot: "A1" },
          },
          {
            ...row,
            id: 2,
            raw_id: 2,
            timestamp: "2026-09-07 11:00:00",
            questions_data: { plot: "B2" },
          },
        ],
        format: "JSONEachRow",
      });
      // Written as text, since a JSON number in JavaScript would lose the cents.
      await admin.insert({
        table: "metadata_rows",
        values: [
          metadataRow("decimals", "A1", '{"area":9007199254740992.01}'),
          metadataRow("decimals", "B2", '{"area":0.01}'),
        ],
        format: "JSONEachRow",
      });
    });

    it("sums and averages them exactly, in Spark's decimal types", async () => {
      const data = await rowsOf(
        decimalRead({
          functions: [
            { column: "area", function: "sum" },
            { column: "area", function: "avg" },
          ],
        }),
      );

      expect(data.columns.map(({ type_text }) => type_text)).toEqual([
        "DECIMAL(32,2)",
        "DECIMAL(26,6)",
      ]);
      expect(data.rows).toEqual([["9007199254740992.02", "4503599627370496.010000"]]);
    });

    it("buckets them by a whole width as Spark divides decimals", async () => {
      const data = await rowsOf({
        ...decimalRead({
          groupBy: [
            {
              column: "area",
              alias: "bucket",
              widthBucket: { origin: 0, width: 1, scale: "number" },
            },
          ],
          functions: [{ column: "*", function: "count" }],
        }),
        ordering: { column: "bucket", direction: "ASC" },
      });

      expect(data.columns.map(({ type_text }) => type_text)).toEqual(["DECIMAL(22,0)", "BIGINT"]);
      expect(data.rows).toEqual([
        ["0", "1"],
        ["9007199254740992", "1"],
      ]);
    });

    it("gives each one's change from the one before exactly, a digit wider", async () => {
      const data = await rowsOf({
        ...decimalRead({ functions: [DECIMAL_CHANGE] }),
        columns: ["id"],
        ordering: { column: "id", direction: "ASC" },
      });

      expect(data.columns.map(({ type_text }) => type_text)).toEqual(["BIGINT", "DECIMAL(23,2)"]);
      expect(data.rows).toEqual([
        ["1", null],
        ["2", "-9007199254740992.00"],
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

const DECIMAL_SCHEMA = "OBJECT<area: DECIMAL(22,2)>";

const DECIMAL_CHANGE = {
  column: "area",
  function: "change_from_previous",
  orderColumn: "timestamp",
  tieBreaker: "id",
  valueType: "DECIMAL(22,2)",
} satisfies AggregateExpression;

/** A chart of the sheets' decimal field `area`, which matches each row by its `plot` answer. */
function decimalRead(aggregation: StoreQueryParams["aggregation"]): StoreQueryParams {
  return {
    tableName: "m1",
    tableType: "macro",
    experimentId: "decimals",
    reservedColumns: STORE_COLUMNS,
    variants: [{ columnName: "custom_metadata", schema: DECIMAL_SCHEMA, suffix: "metadata" }],
    metadataSheets: [{ id: "s1", matchOn: "plot", schema: DECIMAL_SCHEMA, version: "1" }],
    aggregation,
    isChartRead: true,
    limit: CHART_LIMIT,
  };
}

/** A row of sheet s1, which matches on the `plot` answer, holding `fields` as JSON text. */
function metadataRow(experimentId: string, identifier: string, fields: string) {
  return {
    experiment_id: experimentId,
    sheet_id: "s1",
    sheet_created_at: "2026-09-01 08:00:00",
    match_on: "plot",
    identifier,
    fields,
    is_deleted: 0,
    _commit_version: 1,
    _commit_timestamp: "2026-09-01 08:00:01",
  };
}

/**
 * Each read of a table whose own statement, outside the statements nested in it, does not name the
 * experiment, with the text it starts.
 */
function unscopedTableReads(sql: string, experimentId: string): string[] {
  const scope = `experiment_id = '${experimentId}'`;
  return [...sql.matchAll(/\b(?:measurements|macro_results|uploads)\b/g)].flatMap(({ index }) =>
    ownClauses(sql, index).includes(scope) ? [] : [sql.slice(index, index + 80)],
  );
}

/** A statement's text from `start` to its end, the parenthesised parts within it left out. */
function ownClauses(sql: string, start: number): string {
  let depth = 0;
  let own = "";
  for (const char of sql.slice(start)) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")" && depth === 0) {
      break;
    } else if (char === ")") {
      depth -= 1;
    } else if (depth === 0) {
      own += char;
    }
  }
  return own;
}

/**
 * A cell as Spark's result holds it: a double as a number, and anything else as its text, an
 * integer and a decimal exact.
 */
function typedCell(cell: string | null | undefined, type: string): number | string | null {
  if (cell === null || cell === undefined) {
    return null;
  }
  return type === "DOUBLE" ? Number(cell) : cell;
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

async function createReader(admin: ClickHouseClient): Promise<void> {
  await dropReader(admin);
  await admin.command({ query: `CREATE USER ${READER} IDENTIFIED BY '${READER_PASSWORD}'` });
  for (const name of [...STORE_READER_ACCESS.views, ...STORE_READER_ACCESS.tables]) {
    await admin.command({ query: `GRANT SELECT ON store.${name} TO ${READER}` });
  }
  const tables = STORE_READER_ACCESS.tables.map((table) => `store.${table}`).join(", ");
  await admin.command({
    query: `CREATE ROW POLICY ${READER_POLICY} ON ${tables} USING ${STORE_READER_ACCESS.rowFilter} TO ${READER}`,
  });
}

async function dropReader(admin: ClickHouseClient): Promise<void> {
  const tables = STORE_READER_ACCESS.tables.map((table) => `store.${table}`).join(", ");
  await admin.command({ query: `DROP ROW POLICY IF EXISTS ${READER_POLICY} ON ${tables}` });
  await admin.command({ query: `DROP USER IF EXISTS ${READER}` });
}
