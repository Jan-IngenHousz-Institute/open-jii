/** SQL bridge for `pnpm --filter data verify:numeric-question-sorting`; never contacts a warehouse. */
import { Logger } from "@nestjs/common";
import { fromPartial } from "@total-typescript/shoehorn";
import { readFileSync } from "node:fs";
import "reflect-metadata";

import { DatabricksAdapter } from "../src/common/modules/databricks/databricks.adapter";
import type { DatabricksConfigService } from "../src/common/modules/databricks/services/config/config.service";
import { QueryBuilderService } from "../src/common/modules/databricks/services/query-builder/query-builder.service";
import type { SchemaData } from "../src/common/modules/databricks/services/sql/sql.types";
import { success } from "../src/common/utils/fp-utils";
import { ContributorAnonymizerService } from "../src/experiments/application/services/contributor-anonymizer.service";
import type { ExperimentTableMetadata } from "../src/experiments/core/models/experiment-data.model";
import type { ExperimentDto } from "../src/experiments/core/models/experiment.model";
import type { CachePort } from "../src/experiments/core/ports/cache.port";
import type { DatabricksPort } from "../src/experiments/core/ports/databricks.port";
import { ExperimentDataRepository } from "../src/experiments/core/repositories/experiment-data.repository";

interface Scenario {
  name: string;
  tableType?: "static" | "macro" | "upload";
  questionsSchema?: string | null;
  macroSchema?: string | null;
  customMetadataSchema?: string | null;
  uploadSchema?: string | null;
  rowCount?: number;
  viewColumns: string[];
  picker?: { column: string; limit: number };
  distinctDirection?: "DESC";
  lexical?: boolean;
  options: Partial<Parameters<ExperimentDataRepository["getTableData"]>[0]>;
}

async function main() {
  Logger.overrideLogger(false);
  const scenarios = JSON.parse(readFileSync(process.argv[2], "utf8")) as Scenario[];
  const config = fromPartial<DatabricksConfigService>({
    getCatalogName: () => "spark_catalog",
    getCentrumSchemaName: () => "default",
    getMetricsSchemaName: () => "default",
    getRawDataTableName: () => "numeric_sort_raw",
    getDeviceDataTableName: () => "numeric_sort_device",
    getMacroDataTableName: () => "numeric_sort_macro",
    getUploadedDataTableName: () => "numeric_sort_upload",
  });
  const adapter = new DatabricksAdapter(
    fromPartial({}),
    new QueryBuilderService(),
    fromPartial({}),
    fromPartial({}),
    config,
  );
  const cache: CachePort = {
    tryCache: (_key, fetch) => fetch(),
    invalidate: () => Promise.resolve(),
  };
  const responses: Record<string, unknown> = {};
  for (const scenario of scenarios) {
    const tableType = scenario.tableType ?? "static";
    const identifier = tableType === "static" ? "raw_data" : "fixture-table";
    const metadata: ExperimentTableMetadata = {
      identifier,
      tableType,
      displayName: null,
      rowCount: scenario.rowCount ?? 100,
      latestRowAt: null,
      schemaRevision: "fixture",
      macroSchema: scenario.macroSchema ?? null,
      questionsSchema:
        scenario.questionsSchema === undefined
          ? "OBJECT<answer: STRING>"
          : scenario.questionsSchema,
      customMetadataSchema: scenario.customMetadataSchema ?? null,
      uploadSchema: scenario.uploadSchema ?? null,
    };
    const port = fromPartial<DatabricksPort>({
      CENTRUM_SCHEMA_NAME: "default",
      getExperimentTableMetadata: () => Promise.resolve(success([metadata])),
      getExperimentTableColumns: () => Promise.resolve(success(scenario.viewColumns)),
      buildExperimentQuery: (params: Parameters<DatabricksPort["buildExperimentQuery"]>[0]) => {
        const ordering = params.ordering;
        return adapter.buildExperimentQuery({
          ...params,
          ordering: ordering
            ? {
                ...ordering,
                direction: scenario.distinctDirection ?? ordering.direction,
                mode: scenario.lexical ? undefined : ordering.mode,
              }
            : undefined,
        });
      },
      executeSqlQuery: async (_schema: string, sql: string) => {
        const response = await fetch(`${process.env.NUMERIC_SORT_BRIDGE}/sql`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenario: scenario.name, sql }),
        });
        if (!response.ok) throw new Error(await response.text());
        return success((await response.json()) as SchemaData);
      },
    });
    const experiment = fromPartial<ExperimentDto>({
      id: "fixture-experiment",
      name: "Synthetic numeric sort",
      anonymizeContributors: false,
    });
    const repository = new ExperimentDataRepository(
      port,
      cache,
      cache,
      new ContributorAnonymizerService(),
    );
    const params = { experimentId: experiment.id, experiment, tableName: identifier };
    const result = scenario.picker
      ? await repository.getDistinctColumnValues({ ...params, ...scenario.picker })
      : await repository.getTableData({ ...params, ...scenario.options });
    if (result.isFailure()) throw result.error;
    responses[scenario.name] = result.value;
  }
  process.stdout.write(JSON.stringify(responses));
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
