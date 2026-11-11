// From repo root: pnpm --filter @repo/devkit exec tsx --tsconfig ../../apps/backend/tsconfig.json ../../apps/backend/scripts/check-ordered-aggregates-sql.ts --profile DEV_PROFILE [--warehouse ID]
// Uses synthetic VALUES only. Statement Execution API: https://docs.databricks.com/api/statement-execution/v1/execute-statement
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { z } from "zod";

import { QueryBuilderService } from "../src/common/modules/databricks/services/query-builder/query-builder.service";
import type {
  AggregateExpression,
  QueryParams,
} from "../src/common/modules/databricks/services/query-builder/query-builder.types";

const builder = new QueryBuilderService();
const names = ["id", "station", "timestamp", "value", "at_ntz", "day"];
const fixture = `readings AS (
  SELECT id, station, CAST(at AS TIMESTAMP) AS timestamp, CAST(value AS DOUBLE) AS value,
    CAST(REPLACE(at, 'Z', '') AS TIMESTAMP_NTZ) AS at_ntz, CAST(SUBSTRING(at, 1, 10) AS DATE) AS day
  FROM VALUES
    ('a0', 'A', NULL, 900),
    ('a1', 'A', '2026-01-01T23:59:59.500000Z', 10),
    ('a2', 'A', '2026-01-02T00:00:00.500000Z', NULL),
    ('a3', 'A', '2026-01-02T00:00:00.500000Z', 30),
    ('a4', 'A', '2026-01-02T00:00:00.500000Z', 40),
    ('b1', 'B', '2026-01-01T23:59:59.500000Z', 50),
    ('b2', 'B', '2026-01-01T23:59:59.500000Z', 60),
    ('b3', 'B', '2026-01-02T00:00:00.500000Z', NULL),
    ('b9', 'B', NULL, 950),
    ('c0', 'C', NULL, 1000),
    ('c1', 'C', '2026-01-02T00:00:00.250000Z', 1001),
    ('d0', 'D', NULL, 1100)
  AS input(id, station, at, value)
), weather AS (
  SELECT id, station, CAST(at AS TIMESTAMP) AS timestamp, CAST(value AS DOUBLE) AS value
  FROM VALUES
    ('s1', 'A', '2026-01-01T23:59:59.000000Z', 100),
    ('s2', 'A', '2026-01-02T00:00:00.000000Z', NULL),
    ('s3', 'A', '2026-01-02T00:00:00.000000Z', 300),
    ('s4', 'B', '2026-01-01T23:59:59.000000Z', 400),
    ('s5', 'B', '2026-01-02T00:00:00.000000Z', 500),
    ('s6', 'C', NULL, 999)
  AS input(id, station, at, value)
), joined_reference AS (
  SELECT p.*, s.id AS second__id, s.timestamp AS second__timestamp, s.value AS second__value
  FROM readings p LEFT JOIN weather s ON p.station = s.station
    AND s.timestamp <= p.timestamp AND s.timestamp >= p.timestamp - INTERVAL '5' MINUTE
  QUALIFY ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY s.timestamp DESC NULLS LAST, s.id ASC) = 1
)`;

function sql(params: QueryParams): string {
  const result = builder.buildQuery(params);
  if (result.isFailure()) throw result.error;
  return result.value;
}

function windowFunctions(column: string, partitioned: boolean): AggregateExpression[] {
  const window = {
    orderColumn: "timestamp",
    partitionColumn: partitioned ? "station" : undefined,
    tieBreaker: "id",
  };
  return [
    { ...window, column, function: "previous", alias: "prev" },
    { ...window, column, function: "change_from_previous", valueType: "DOUBLE", alias: "delta" },
    { ...window, column: "*", function: "row_number", alias: "number" },
    ...(
      [
        ["timestamp", "TIMESTAMP", "seconds"],
        ["at_ntz", "TIMESTAMP_NTZ", "ntz_seconds"],
        ["day", "DATE", "date_seconds"],
      ] as const
    ).map(
      ([column, valueType, alias]): AggregateExpression => ({
        ...window,
        column,
        function: "change_from_previous",
        valueType,
        alias,
      }),
    ),
  ];
}

function referenceWindows(
  table: string,
  value: string,
  partitioned: boolean,
  orderColumn = "timestamp",
): string {
  const w = `${partitioned ? "PARTITION BY station " : ""}ORDER BY ${orderColumn} ASC, id ASC`;
  return `SELECT *, LAG(${value}) OVER (${w}) AS prev,
    ${value} - LAG(${value}) OVER (${w}) AS delta, ROW_NUMBER() OVER (${w}) AS number,
    timestampdiff(MICROSECOND, LAG(timestamp) OVER (${w}), timestamp) / 1e6 AS seconds,
    timestampdiff(MICROSECOND, LAG(at_ntz) OVER (${w}), at_ntz) / 1e6 AS ntz_seconds,
    datediff(day, LAG(day) OVER (${w})) * 86400.0 AS date_seconds
    FROM ${table} WHERE ${orderColumn} IS NOT NULL
    UNION ALL SELECT *, NULL, NULL, NULL, NULL, NULL, NULL FROM ${table} WHERE ${orderColumn} IS NULL`;
}

function referenceExtremes(table: string, value: string, grouped: boolean): string {
  const selected = (
    direction: string,
  ) => `SELECT ${grouped ? "station, " : ""}${value} AS value FROM ${table}
    WHERE timestamp IS NOT NULL QUALIFY ROW_NUMBER() OVER (${grouped ? "PARTITION BY station " : ""}ORDER BY timestamp ${direction}, id ${direction}) = 1`;
  return grouped
    ? `SELECT g.station, hi.value AS latest_value, lo.value AS earliest_value
       FROM (SELECT DISTINCT station FROM ${table}) g
       LEFT JOIN (${selected("DESC")}) hi ON g.station = hi.station
       LEFT JOIN (${selected("ASC")}) lo ON g.station = lo.station`
    : `SELECT (SELECT value FROM (${selected("DESC")})) AS latest_value,
       (SELECT value FROM (${selected("ASC")})) AS earliest_value`;
}

function comparisonStatement(): { statement: string; count: number } {
  const cases: { name: string; columns: string; actual: string; reference: string }[] = [];
  for (const partitioned of [true, false]) {
    cases.push({
      name: partitioned ? "partitioned windows" : "whole-table windows",
      columns: "id, prev, delta, number, seconds, ntz_seconds, date_seconds",
      actual: sql({
        table: "readings",
        columnNames: names,
        aggregation: { functions: windowFunctions("value", partitioned) },
      }),
      reference: referenceWindows("readings", "value", partitioned),
    });
  }
  cases.push({
    name: "filter before window",
    columns: "id, prev, delta, number, seconds, ntz_seconds, date_seconds",
    actual: sql({
      table: "readings",
      columnNames: names,
      filters: [{ column: "id", operator: "not_equals", value: "a1" }],
      aggregation: { functions: windowFunctions("value", true) },
    }),
    reference: referenceWindows("(SELECT * FROM readings WHERE id <> 'a1')", "value", true),
  });
  const join: QueryParams["join"] = {
    secondary: { table: "weather" },
    primaryColumns: names,
    secondaryColumns: ["id", "timestamp", "value"].map((name) => ({
      name,
      alias: `second__${name}`,
    })),
    matchColumn: "station",
    primaryTimeColumn: "timestamp",
    secondaryTimeColumn: "timestamp",
    primaryTimeType: "TIMESTAMP",
    secondaryTimeType: "TIMESTAMP",
    toleranceMinutes: 5,
  };
  cases.push({
    name: "joined windows",
    columns: "id, second__id, prev, delta, number, seconds, ntz_seconds, date_seconds",
    actual: sql({
      table: "readings",
      join,
      aggregation: { functions: windowFunctions("second__value", true) },
    }),
    reference: referenceWindows("joined_reference", "second__value", true),
  });
  cases.push({
    name: "joined windows ordered by second table",
    columns: "id, second__id, prev, delta, number, seconds, ntz_seconds, date_seconds",
    actual: sql({
      table: "readings",
      join,
      aggregation: {
        functions: windowFunctions("second__value", true).map((item) => ({
          ...item,
          orderColumn: "second__timestamp",
        })),
      },
    }),
    reference: referenceWindows("joined_reference", "second__value", true, "second__timestamp"),
  });
  for (const [grouped, joined] of [
    [true, false],
    [false, false],
    [true, true],
  ] as const) {
    const column = joined ? "second__value" : "value";
    cases.push({
      name: joined
        ? "joined latest and earliest"
        : grouped
          ? "grouped latest and earliest"
          : "whole-table latest and earliest",
      columns: `${grouped ? "station, " : ""}latest_value, earliest_value`,
      actual: sql({
        table: "readings",
        ...(joined ? { join } : {}),
        aggregation: {
          groupBy: grouped ? [{ column: "station" }] : undefined,
          functions: ["latest", "earliest"].map(
            (fn): AggregateExpression => ({
              column,
              function: fn === "latest" ? "latest" : "earliest",
              orderColumn: "timestamp",
              tieBreaker: "id",
              alias: `${fn}_value`,
            }),
          ),
        },
      }),
      reference: referenceExtremes(joined ? "joined_reference" : "readings", column, grouped),
    });
  }
  const ctes = cases.flatMap((test, i) => [
    `actual_${i} AS (${test.actual})`,
    `reference_${i} AS (${test.reference})`,
    `extra_${i} AS (SELECT ${test.columns} FROM actual_${i} EXCEPT ALL SELECT ${test.columns} FROM reference_${i})`,
    `missing_${i} AS (SELECT ${test.columns} FROM reference_${i} EXCEPT ALL SELECT ${test.columns} FROM actual_${i})`,
  ]);
  return {
    statement: `WITH ${fixture}, ${ctes.join(",\n")}\n${cases.map((test, i) => `SELECT '${test.name}' AS comparison, (SELECT COUNT(*) FROM extra_${i}) + (SELECT COUNT(*) FROM missing_${i}) AS mismatches`).join("\nUNION ALL\n")}`,
    count: cases.length,
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { profile: { type: "string" }, warehouse: { type: "string" } },
    strict: true,
  });
  const profile = values.profile?.trim();
  if (!profile || profile.toUpperCase() === "DEFAULT" || /prod/i.test(profile))
    throw new Error(
      "Pass --profile with an explicit dev profile name; DEFAULT and names containing prod are not allowed",
    );
  const cli = (args: string[]): unknown =>
    JSON.parse(
      execFileSync("databricks", [...args, "--profile", profile, "--output", "json"], {
        encoding: "utf8",
        timeout: 60000,
        maxBuffer: 4 * 1024 * 1024,
      }),
    );
  let warehouse = values.warehouse?.trim();
  if (!warehouse) {
    const item = z.object({ id: z.string(), state: z.string().optional() });
    const listing = z
      .union([
        z.array(item),
        z.object({ warehouses: z.array(item) }).transform((value) => value.warehouses),
      ])
      .parse(cli(["warehouses", "list"]));
    const running = listing.filter((item) => item.state === "RUNNING");
    warehouse = (running.length === 1 ? running[0] : listing.length === 1 ? listing[0] : undefined)
      ?.id;
    if (!warehouse) throw new Error("Warehouse selection is ambiguous; pass --warehouse ID");
  }
  const responseSchema = z.object({
    statement_id: z.string(),
    status: z.object({
      state: z.string(),
      error: z.object({ message: z.string().optional() }).optional(),
    }),
    manifest: z
      .object({
        total_row_count: z.number(),
        total_chunk_count: z.number(),
        truncated: z.boolean().optional(),
      })
      .optional(),
    result: z.object({ data_array: z.array(z.tuple([z.string(), z.string()])) }).optional(),
  });
  const { statement, count } = comparisonStatement();
  console.log(
    `Comparing ${count} synthetic query results with profile ${profile}, warehouse ${warehouse}`,
  );
  let response = responseSchema.parse(
    cli([
      "api",
      "post",
      "/api/2.0/sql/statements",
      "--json",
      JSON.stringify({
        warehouse_id: warehouse,
        statement,
        format: "JSON_ARRAY",
        disposition: "INLINE",
        wait_timeout: "50s",
        on_wait_timeout: "CONTINUE",
        row_limit: count + 1,
      }),
    ]),
  );
  const deadline = Date.now() + 5 * 60_000;
  while (["PENDING", "RUNNING"].includes(response.status.state) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    response = responseSchema.parse(
      cli(["api", "get", `/api/2.0/sql/statements/${response.statement_id}`]),
    );
  }
  if (response.status.state !== "SUCCEEDED")
    throw new Error(
      response.status.error?.message ??
        `Statement ${response.statement_id}: ${response.status.state}`,
    );
  const rows = response.result?.data_array;
  if (
    rows?.length !== count ||
    response.manifest?.truncated ||
    response.manifest?.total_row_count !== count ||
    response.manifest.total_chunk_count !== 1
  )
    throw new Error("Incomplete comparison results");
  let mismatches = 0;
  for (const [name, value] of rows) {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Invalid mismatch count for ${name}`);
    console.log(`${name}: ${n} mismatches`);
    mismatches += n;
  }
  if (mismatches > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
