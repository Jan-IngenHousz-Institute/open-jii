/**
 * Warehouse-vs-DuckDB parity harness for the experiment-data read path.
 *
 * Runs the same query matrix through both ExperimentDataReadPort
 * implementations against a real environment and diffs the results.
 *
 * Usage (with dev env vars exported, EXPERIMENT_DATA_READ_ADAPTER ignored):
 *   npx tsx scripts/experiment-data-parity.ts <experimentId> [<experimentId> ...]
 */
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

import databricksConfig from "../src/common/config/databricks.config";
import deltaConfig from "../src/common/config/delta.config";
import duckdbConfig from "../src/common/config/duckdb.config";
import { DatabricksAdapter } from "../src/common/modules/databricks/databricks.adapter";
import { DatabricksAuthService } from "../src/common/modules/databricks/services/auth/auth.service";
import { DatabricksConfigService } from "../src/common/modules/databricks/services/config/config.service";
import { DatabricksFilesService } from "../src/common/modules/databricks/services/files/files.service";
import { DatabricksJobsService } from "../src/common/modules/databricks/services/jobs/jobs.service";
import { DuckDbQueryBuilderService } from "../src/common/modules/databricks/services/query-builder/duckdb-query-builder.service";
import { QueryBuilderService } from "../src/common/modules/databricks/services/query-builder/query-builder.service";
import { VariantSchema } from "../src/common/modules/databricks/services/query-builder/schema/variant-schema";
import { DatabricksSqlService } from "../src/common/modules/databricks/services/sql/sql.service";
import type { SchemaData } from "../src/common/modules/databricks/services/sql/sql.types";
import { DuckDbAdapter } from "../src/common/modules/duckdb/duckdb.adapter";
import { DuckDbConfigService } from "../src/common/modules/duckdb/services/config/duckdb-config.service";
import { SparkTypeMapper } from "../src/common/modules/duckdb/services/schema/spark-type-mapper";
import { DuckDbSessionService } from "../src/common/modules/duckdb/services/session/duckdb-session.service";
import { DeltaSharingService } from "../src/common/modules/duckdb/services/sharing/delta-sharing.service";
import type { ExperimentTableMetadata } from "../src/experiments/core/models/experiment-data.model";
import type { ExperimentDataReadPort } from "../src/experiments/core/ports/experiment-data-read.port";

interface Case {
  name: string;
  params: Omit<Parameters<ExperimentDataReadPort["buildExperimentQuery"]>[0], "tableType"> & {
    tableType: "static" | "macro" | "upload";
  };
}

interface CaseOutcome {
  name: string;
  table: string;
  passed: boolean;
  detail?: string;
  warehouseMs: number;
  duckdbMs: number;
}

function buildAdapters(): { warehouse: ExperimentDataReadPort; duckdb: ExperimentDataReadPort } {
  const configService = new ConfigService({
    databricks: databricksConfig(),
    delta: deltaConfig(),
    duckdb: { ...duckdbConfig(), localMode: false },
  });
  const httpService = new HttpService(axios.create());

  const databricksConfigService = new DatabricksConfigService(configService);
  const authService = new DatabricksAuthService(databricksConfigService, httpService);
  const warehouse = new DatabricksAdapter(
    new DatabricksJobsService(httpService, authService, databricksConfigService),
    new QueryBuilderService(),
    new DatabricksSqlService(httpService, authService, databricksConfigService),
    new DatabricksFilesService(httpService, databricksConfigService, authService),
    databricksConfigService,
  );

  const duckDbConfigService = new DuckDbConfigService(configService);
  const duckdb = new DuckDbAdapter(
    duckDbConfigService,
    new DuckDbSessionService(duckDbConfigService),
    new DeltaSharingService(httpService, duckDbConfigService),
    new DuckDbQueryBuilderService(),
    new SparkTypeMapper(),
  );

  return { warehouse, duckdb };
}

function variantSpecFor(metadata: ExperimentTableMetadata): {
  variants: { columnName: string; schema: string }[];
  numericField?: string;
} {
  const bySchema: [string, string | null | undefined][] = [
    ["macro_output", metadata.macroSchema],
    ["questions_data", metadata.questionsSchema],
    ["custom_metadata", metadata.customMetadataSchema],
    ["uploaded_data", metadata.uploadSchema],
  ];
  const variants = bySchema
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([columnName, schema]) => ({ columnName, schema }));

  const numericField = variants
    .flatMap((v) => VariantSchema.topLevelFields(v.schema))
    .find((f) => ["DOUBLE", "FLOAT", "BIGINT", "INT"].includes(f.type.toUpperCase()))?.name;

  return { variants, numericField };
}

function casesFor(experimentId: string, metadata: ExperimentTableMetadata): Case[] {
  const { variants, numericField } = variantSpecFor(metadata);
  const base = {
    tableName: metadata.identifier,
    tableType: metadata.tableType,
    experimentId,
    variants: variants.length > 0 ? variants : undefined,
    exceptColumns: ["experiment_id"],
  };

  const cases: Case[] = [
    { name: "first-page", params: { ...base, limit: 5, offset: 0 } },
    { name: "deep-page", params: { ...base, limit: 5, offset: 10 } },
  ];

  if (numericField) {
    cases.push(
      {
        name: "variant-filter",
        params: {
          ...base,
          filters: [{ column: numericField, operator: "greater_than", value: 0 }],
          limit: 20,
        },
      },
      {
        name: "distinct-values",
        params: {
          ...base,
          columns: [numericField],
          distinct: true,
          orderBy: numericField,
          orderDirection: "ASC",
          limit: 50,
        },
      },
      {
        name: "aggregation",
        params: {
          ...base,
          aggregation: {
            groupBy: [{ column: "timestamp", timeBucket: "hour" }],
            functions: [
              { column: numericField, function: "avg" },
              { column: "*", function: "count" },
            ],
          },
          orderBy: "timestamp_hour",
          orderDirection: "ASC",
          limit: 50,
        },
      },
    );
  }

  return cases;
}

function normalizeCell(cell: string | null): string | null {
  if (cell === null) return null;
  try {
    const parsed: unknown = JSON.parse(cell);
    if (parsed !== null && typeof parsed === "object") {
      return JSON.stringify(parsed, Object.keys(parsed as object).sort());
    }
  } catch {
    // scalar text stays as-is
  }
  return cell;
}

function diff(warehouse: SchemaData, duckdb: SchemaData): string | undefined {
  const whCols = warehouse.columns.map((c) => `${c.name}:${c.type_text}`);
  const ddCols = duckdb.columns.map((c) => `${c.name}:${c.type_text}`);
  if (whCols.join("|") !== ddCols.join("|")) {
    return `columns differ:\n  warehouse: ${whCols.join(", ")}\n  duckdb:    ${ddCols.join(", ")}`;
  }
  if (warehouse.rows.length !== duckdb.rows.length) {
    return `row counts differ: warehouse=${warehouse.rows.length} duckdb=${duckdb.rows.length}`;
  }

  const normalize = (rows: (string | null)[][]): string[] =>
    rows.map((row) => row.map(normalizeCell).join("")).sort();

  const wh = normalize(warehouse.rows);
  const dd = normalize(duckdb.rows);
  for (let i = 0; i < wh.length; i++) {
    if (wh[i] !== dd[i]) {
      return `row ${i} differs:\n  warehouse: ${wh[i]}\n  duckdb:    ${dd[i]}`;
    }
  }
  return undefined;
}

async function runCase(
  adapters: { warehouse: ExperimentDataReadPort; duckdb: ExperimentDataReadPort },
  testCase: Case,
): Promise<CaseOutcome> {
  const outcome = async (
    port: ExperimentDataReadPort,
  ): Promise<{ data?: SchemaData; error?: string; ms: number }> => {
    const start = Date.now();
    const queryResult = await port.buildExperimentQuery(testCase.params);
    if (queryResult.isFailure()) {
      return { error: `buildExperimentQuery: ${queryResult.error.message}`, ms: 0 };
    }
    const dataResult = await port.executeSqlQuery("centrum", queryResult.value);
    const ms = Date.now() - start;
    if (dataResult.isFailure()) {
      return { error: dataResult.error.message, ms };
    }
    return { data: dataResult.value, ms };
  };

  const wh = await outcome(adapters.warehouse);
  const dd = await outcome(adapters.duckdb);

  const detail =
    wh.error ?? dd.error
      ? `warehouse: ${wh.error ?? "ok"} | duckdb: ${dd.error ?? "ok"}`
      : wh.data && dd.data
        ? diff(wh.data, dd.data)
        : "missing data";

  return {
    name: testCase.name,
    table: testCase.params.tableName,
    passed: detail === undefined,
    detail,
    warehouseMs: wh.ms,
    duckdbMs: dd.ms,
  };
}

async function main(): Promise<void> {
  const experimentIds = process.argv.slice(2);
  if (experimentIds.length === 0) {
    console.error("usage: npx tsx scripts/experiment-data-parity.ts <experimentId> [...]");
    process.exit(2);
  }

  const adapters = buildAdapters();
  const outcomes: CaseOutcome[] = [];

  for (const experimentId of experimentIds) {
    const metadataResult = await adapters.warehouse.getExperimentTableMetadata(experimentId);
    if (metadataResult.isFailure()) {
      console.error(`metadata failed for ${experimentId}: ${metadataResult.error.message}`);
      process.exitCode = 1;
      continue;
    }

    const duckMetadata = await adapters.duckdb.getExperimentTableMetadata(experimentId);
    if (duckMetadata.isFailure()) {
      console.error(`duckdb metadata failed for ${experimentId}: ${duckMetadata.error.message}`);
      process.exitCode = 1;
      continue;
    }

    for (const metadata of metadataResult.value) {
      for (const testCase of casesFor(experimentId, metadata)) {
        const result = await runCase(adapters, testCase);
        outcomes.push(result);
        const status = result.passed ? "PASS" : "FAIL";
        console.log(
          `${status}  ${experimentId}/${result.table}/${result.name}  wh=${result.warehouseMs}ms dd=${result.duckdbMs}ms`,
        );
        if (!result.passed && result.detail) {
          console.log(`      ${result.detail.split("\n").join("\n      ")}`);
        }
      }
    }
  }

  const failed = outcomes.filter((o) => !o.passed).length;
  console.log(`\n${outcomes.length - failed}/${outcomes.length} cases passed`);
  if (failed > 0) {
    process.exit(1);
  }
}

void main();
