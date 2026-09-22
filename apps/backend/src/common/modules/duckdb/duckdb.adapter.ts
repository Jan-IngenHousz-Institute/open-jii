import { Injectable, Logger } from "@nestjs/common";

import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { retainEnrichment } from "../../../experiments/core/models/enrichment";
import type {
  EnrichmentJoin,
  EnrichmentSql,
  ExperimentTableMetadata,
} from "../../../experiments/core/models/experiment-data.model";
import type { ExperimentDataReadPort } from "../../../experiments/core/ports/experiment-data-read.port";
import { Result, success, failure, AppError } from "../../utils/fp-utils";
import { DuckDbQueryBuilderService } from "../databricks/services/query-builder/duckdb-query-builder.service";
import { DUCKDB_ENRICHMENT_SQL } from "../databricks/services/query-builder/enrichment-sql";
import type {
  AggregationSpec,
  FilterCondition,
  JoinSpec,
} from "../databricks/services/query-builder/query-builder.types";
import type { SchemaData } from "../databricks/services/sql/sql.types";
import { DeltaSharingService } from "../delta/services/sharing/delta-sharing.service";
import { DuckDbConfigService } from "./services/config/duckdb-config.service";
import { SparkTypeMapper } from "./services/schema/spark-type-mapper";
import { DuckDbSessionService } from "./services/session/duckdb-session.service";

/**
 * Stands in for a query whose share has no data files. `read_parquet` cannot
 * bind an empty file list, so there is no relation to select from; this marker
 * makes {@link DuckDbAdapter.executeSqlQuery} return an empty result set,
 * matching the warehouse (which answers an empty table with zero rows, not an
 * error).
 */
const EMPTY_RESULT_QUERY = "-- openjii:no-delta-files";

/**
 * Experiment-data read engine: Delta Sharing supplies pre-signed parquet
 * URLs (scoped per experiment), embedded DuckDB runs the SQL over them.
 * Mirrors the DatabricksAdapter's read surface and wire contract (string
 * cells, Spark type_text) so the repository can't tell the engines apart.
 */
@Injectable()
export class DuckDbAdapter implements ExperimentDataReadPort {
  private readonly logger = new Logger(DuckDbAdapter.name);

  readonly CENTRUM_SCHEMA_NAME: string;

  constructor(
    private readonly configService: DuckDbConfigService,
    private readonly sessionService: DuckDbSessionService,
    private readonly sharingService: DeltaSharingService,
    private readonly queryBuilder: DuckDbQueryBuilderService,
    private readonly typeMapper: SparkTypeMapper,
  ) {
    this.CENTRUM_SCHEMA_NAME = this.configService.getCentrumSchemaName();
  }

  async getExperimentTableMetadata(
    experimentId: string,
    options?: {
      identifier?: string;
      includeSchemas?: boolean;
    },
  ): Promise<Result<ExperimentTableMetadata[]>> {
    const includeSchemas = options?.includeSchemas !== false;
    const columns = includeSchemas
      ? [
          "identifier",
          "table_type",
          "display_name",
          "row_count",
          "macro_schema",
          "questions_schema",
          "custom_metadata_schema",
          "upload_schema",
        ]
      : ["identifier", "table_type", "display_name", "row_count"];

    const whereConditions: [string, string][] = [["experiment_id", experimentId]];
    if (options?.identifier) {
      whereConditions.push(["identifier", options.identifier]);
    }

    const fromResult = await this.fromExpression("experiment_table_metadata", whereConditions);
    if (fromResult.isFailure()) {
      return failure(fromResult.error);
    }
    if (fromResult.value === null) {
      return success([]);
    }

    const queryResult = this.queryBuilder.buildQuery({
      table: fromResult.value,
      columns,
      whereConditions,
    });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const result = await this.executeSqlQuery(this.CENTRUM_SCHEMA_NAME, queryResult.value);
    if (result.isFailure()) {
      return failure(result.error);
    }

    const metadata: ExperimentTableMetadata[] = result.value.rows.map((row) => {
      const identifier = row[0] ?? "";
      const tableType = (row[1] ?? "static") as "static" | "macro" | "upload";
      const displayName = row[2] ?? null;
      const rowCount = row[3] ? parseInt(row[3], 10) : 0;

      if (includeSchemas) {
        return {
          identifier,
          tableType,
          displayName,
          rowCount,
          macroSchema: row[4],
          questionsSchema: row[5],
          customMetadataSchema: row[6],
          uploadSchema: row[7],
        };
      }

      return { identifier, tableType, displayName, rowCount };
    });

    return success(metadata);
  }

  /**
   * Same dispatch as the Databricks adapter (macro/upload share physical
   * tables scoped by id columns); the FROM source is the per-query file list.
   */
  async buildExperimentQuery(params: {
    tableName: string;
    tableType: "static" | "macro" | "upload";
    experimentId: string;
    columns?: string[];
    enrichmentJoins?: (sql: EnrichmentSql) => EnrichmentJoin[];
    /** Enrichment aliases to drop, having no schema to flatten. */
    omitEnrichment?: string[];
    variants?: { columnName: string; schema: string }[];
    exceptColumns?: string[];
    filters?: FilterCondition[];
    aggregation?: AggregationSpec;
    distinct?: boolean;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  }): Promise<Result<string>> {
    const { tableName, tableType, experimentId, enrichmentJoins, omitEnrichment, ...queryParams } =
      params;

    const target = this.resolveTarget(tableName, tableType, experimentId);
    if (target.isFailure()) {
      return target;
    }
    const { physicalTable, whereConditions } = target.value;

    const fromResult = await this.fromExpression(physicalTable, whereConditions);
    if (fromResult.isFailure()) {
      return fromResult;
    }
    if (fromResult.value === null) {
      return success(EMPTY_RESULT_QUERY);
    }

    const joinsResult = await this.resolveJoins(
      retainEnrichment(enrichmentJoins?.(DUCKDB_ENRICHMENT_SQL) ?? [], omitEnrichment),
    );
    if (joinsResult.isFailure()) {
      return joinsResult;
    }

    return this.queryBuilder.buildQuery({
      ...queryParams,
      table: fromResult.value,
      joins: joinsResult.value,
      whereConditions,
    });
  }

  /**
   * Each dimension is its own scan here, because this engine reads files
   * rather than a catalog: there is no `centrum.experiment_contributors` to
   * name, only the parquet the share hands back. Listings are unscoped,
   * since the dimensions are small and an experiment-scoped hint would prune
   * a share down to nothing for a dimension that is legitimately sparse.
   */
  private async resolveJoins(joins: EnrichmentJoin[]): Promise<Result<JoinSpec[]>> {
    const resolved: JoinSpec[] = [];

    for (const join of joins) {
      const sourceResult = await this.fromExpression(join.relation, []);
      if (sourceResult.isFailure()) {
        return sourceResult;
      }

      // A dimension with no data files cannot be given a shape here, and a
      // LEFT JOIN against nothing would have to project NULLs this route
      // cannot name. Failing loudly beats serving rows whose enrichment is
      // silently absent.
      if (sourceResult.value === null) {
        return failure(
          AppError.internal(
            `Delta Sharing returned no data files for '${join.relation}', so the ` +
              `enrichment it provides cannot be resolved`,
          ),
        );
      }

      resolved.push({
        table: join.derive
          ? join.derive.replace("{relation}", sourceResult.value)
          : sourceResult.value,
        alias: join.alias,
        on: join.on,
        select: join.select,
      });
    }

    return success(resolved);
  }

  async executeSqlQuery(_schemaName: string, sqlStatement: string): Promise<Result<SchemaData>> {
    if (sqlStatement === EMPTY_RESULT_QUERY) {
      return success({ columns: [], rows: [], totalRows: 0, truncated: false });
    }

    try {
      const reader = await this.sessionService.run(sqlStatement);

      const duckDbTypes = reader.columnTypes().map((type) => String(type));
      const columns = reader.columnNames().map((name, position) => ({
        name,
        type_name: this.typeMapper.toSparkTypeName(duckDbTypes[position]),
        type_text: this.typeMapper.toSparkTypeText(duckDbTypes[position]),
        position,
      }));

      const rows = reader
        .getRowsJson()
        .map((row) =>
          row.map((cell, index) => this.typeMapper.toCellString(cell, duckDbTypes[index])),
        );

      return success({
        columns,
        rows,
        totalRows: rows.length,
        truncated: false,
      });
    } catch (error) {
      this.logger.error({
        msg: "DuckDB query failed",
        operation: "executeSqlQuery",
        // The SQL embeds pre-signed URLs, which are bearer credentials for the
        // data files; only the redacted shape is safe to log.
        sql: DuckDbAdapter.redactSignedUrls(sqlStatement),
        error,
      });
      if (error instanceof AppError) {
        return failure(error);
      }
      const message = error instanceof Error ? error.message : String(error);
      return failure(AppError.internal(`DuckDB query execution failed: ${message}`));
    }
  }

  /** Replace pre-signed file URLs with a count so SQL stays loggable. */
  private static redactSignedUrls(sql: string): string {
    // Global and non-greedy: enrichment adds a scan per dimension, and missing
    // one leaks that dimension's pre-signed URLs into the log verbatim.
    return sql.replace(/read_parquet\(\[(.*?)\]/gs, (_match, urls: string) => {
      const count = urls.split("', '").length;
      return `read_parquet([<${count} pre-signed url(s) redacted>]`;
    });
  }

  private resolveTarget(
    tableName: string,
    tableType: "static" | "macro" | "upload",
    experimentId: string,
  ): Result<{ physicalTable: string; whereConditions: [string, string][] }> {
    if (tableType === "macro") {
      return success({
        physicalTable: this.configService.getMacroDataTableName(),
        whereConditions: [
          ["experiment_id", experimentId],
          ["macro_id", tableName],
        ],
      });
    }

    if (tableType === "upload") {
      return success({
        physicalTable: this.configService.getUploadedDataTableName(),
        whereConditions: [
          ["experiment_id", experimentId],
          ["upload_table_id", tableName],
        ],
      });
    }

    const staticTableMapping: Record<string, string> = {
      [ExperimentTableName.RAW_DATA]: this.configService.getRawDataTableName(),
      [ExperimentTableName.DEVICE]: this.configService.getDeviceDataTableName(),
    };
    const physicalTable = staticTableMapping[tableName];
    if (!physicalTable) {
      return failure(
        AppError.internal(
          `No physical table mapping found for static table '${tableName}'`,
          "UNKNOWN_TABLE_MAPPING",
        ),
      );
    }

    return success({
      physicalTable,
      whereConditions: [["experiment_id", experimentId]],
    });
  }

  /**
   * FROM source for a physical table, or null when the share holds no data
   * files for it. Local mode targets bare in-memory tables so integration
   * specs run without Delta Sharing; otherwise a fresh pre-signed file list
   * becomes a read_parquet scan. union_by_name tolerates files written before
   * a column was added to the table.
   */
  private async fromExpression(
    physicalTable: string,
    scopes: [string, string][],
  ): Promise<Result<string | null>> {
    if (this.configService.isLocalMode()) {
      return success(`"${physicalTable.replace(/"/g, '""')}"`);
    }

    const urlsResult = await this.sharingService.getDataFileUrls(physicalTable, scopes);
    if (urlsResult.isFailure()) {
      return urlsResult;
    }
    if (urlsResult.value.length === 0) {
      return success(null);
    }

    const urlList = urlsResult.value.map((url) => `'${url.replace(/'/g, "''")}'`).join(", ");
    return success(`read_parquet([${urlList}], union_by_name = true)`);
  }
}
