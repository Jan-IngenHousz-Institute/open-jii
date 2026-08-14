import { Injectable, Logger } from "@nestjs/common";

import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { ExperimentTableMetadata } from "../../../experiments/core/models/experiment-data.model";
import type { ExperimentDataReadPort } from "../../../experiments/core/ports/experiment-data-read.port";
import { Result, success, failure, AppError } from "../../utils/fp-utils";
import { DuckDbQueryBuilderService } from "../databricks/services/query-builder/duckdb-query-builder.service";
import type {
  AggregationSpec,
  FilterCondition,
} from "../databricks/services/query-builder/query-builder.types";
import type { SchemaData } from "../databricks/services/sql/sql.types";
import { DuckDbConfigService } from "./services/config/duckdb-config.service";
import { SparkTypeMapper } from "./services/schema/spark-type-mapper";
import { DuckDbSessionService } from "./services/session/duckdb-session.service";

/**
 * Experiment-data read engine backed by embedded DuckDB scanning the Delta
 * tables through Unity Catalog. Mirrors the DatabricksAdapter's read surface
 * and wire contract (string cells, Spark type_text) so the repository can't
 * tell the engines apart.
 */
@Injectable()
export class DuckDbAdapter implements ExperimentDataReadPort {
  private readonly logger = new Logger(DuckDbAdapter.name);

  readonly CENTRUM_SCHEMA_NAME: string;

  constructor(
    private readonly configService: DuckDbConfigService,
    private readonly sessionService: DuckDbSessionService,
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

    const queryResult = this.queryBuilder.buildQuery({
      table: this.sessionService.tableRef("experiment_table_metadata"),
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
   * tables scoped by id columns), targeting the attached catalog.
   */
  buildExperimentQuery(params: {
    tableName: string;
    tableType: "static" | "macro" | "upload";
    experimentId: string;
    columns?: string[];
    variants?: { columnName: string; schema: string }[];
    exceptColumns?: string[];
    filters?: FilterCondition[];
    aggregation?: AggregationSpec;
    distinct?: boolean;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  }): Result<string> {
    const { tableName, tableType, experimentId, ...queryParams } = params;

    if (tableType === "macro") {
      return this.queryBuilder.buildQuery({
        ...queryParams,
        table: this.sessionService.tableRef(this.configService.getMacroDataTableName()),
        whereConditions: [
          ["experiment_id", experimentId],
          ["macro_id", tableName],
        ],
      });
    }

    if (tableType === "upload") {
      return this.queryBuilder.buildQuery({
        ...queryParams,
        table: this.sessionService.tableRef(this.configService.getUploadedDataTableName()),
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

    return this.queryBuilder.buildQuery({
      ...queryParams,
      table: this.sessionService.tableRef(physicalTable),
      whereConditions: [["experiment_id", experimentId]],
    });
  }

  async executeSqlQuery(_schemaName: string, sqlStatement: string): Promise<Result<SchemaData>> {
    try {
      const reader = await this.sessionService.run(sqlStatement);

      const columns = reader.columnNames().map((name, position) => {
        const typeText = this.typeMapper.toSparkTypeText(String(reader.columnTypes()[position]));
        return { name, type_name: typeText, type_text: typeText, position };
      });

      const rows = reader
        .getRowsJson()
        .map((row) => row.map((cell) => this.typeMapper.toCellString(cell)));

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
        sql: sqlStatement,
        error,
      });
      if (error instanceof AppError) {
        return failure(error);
      }
      const message = error instanceof Error ? error.message : String(error);
      return failure(AppError.internal(`DuckDB query execution failed: ${message}`));
    }
  }
}
