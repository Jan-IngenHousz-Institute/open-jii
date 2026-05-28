import { Injectable, Inject, Logger } from "@nestjs/common";

import { isDecimalType, isNumericType } from "@repo/api/utils/column-type-utils";

import type {
  AggregationSpec,
  FilterCondition,
} from "../../../common/modules/databricks/services/query-builder/query-builder.types";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { Result, success, failure, AppError } from "../../../common/utils/fp-utils";
import { ContributorAnonymizerService } from "../../application/services/contributor-anonymizer.service";
import {
  MACRO_TABLE_CONFIG,
  STATIC_TABLE_CONFIG,
  UPLOAD_TABLE_CONFIG,
} from "../models/experiment-data.model";
import type {
  ExperimentTableMetadata,
  SchemaDataDto,
  TableDataDto,
} from "../models/experiment-data.model";
import { ExperimentDto } from "../models/experiment.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

@Injectable()
export class ExperimentDataRepository {
  private readonly logger = new Logger(ExperimentDataRepository.name);

  constructor(
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
    private readonly contributorAnonymizer: ContributorAnonymizerService,
  ) {}

  /**
   * Get table data via one of three paths: paginated read (cached row count),
   * column projection (full scan), or filtered/aggregated read (capped by
   * `limit`, totalRows reflects returned rows only).
   */
  async getTableData(params: {
    experimentId: string;
    experiment: ExperimentDto;
    tableName: string;
    columns?: string[];
    filters?: FilterCondition[];
    aggregation?: AggregationSpec;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
    limit?: number;
  }): Promise<Result<TableDataDto[]>> {
    const {
      experimentId,
      experiment,
      tableName,
      columns,
      filters,
      aggregation,
      orderBy,
      orderDirection = "ASC",
      page = 1,
      pageSize = 5,
      limit,
    } = params;

    const metadataResult = await this.databricksPort.getExperimentTableMetadata(experimentId, {
      identifier: tableName,
      includeSchemas: true,
    });

    if (metadataResult.isFailure()) {
      return metadataResult;
    }
    if (metadataResult.value.length === 0) {
      return failure(AppError.notFound(`Table '${tableName}' not found in experiment`));
    }

    const metadata = metadataResult.value[0];
    const hasAggregation =
      (aggregation?.groupBy?.length ?? 0) > 0 || (aggregation?.functions?.length ?? 0) > 0;
    const hasFilters = (filters?.length ?? 0) > 0;
    const usesAdhocPath = hasAggregation || hasFilters || Boolean(columns);

    if (usesAdhocPath) {
      // Aggregation defines its own projection; passing `columns` would shadow it.
      const effectiveColumns = hasAggregation ? undefined : columns;
      const queryResult = this.buildQuery(experimentId, metadata, {
        columns: effectiveColumns,
        filters,
        aggregation,
        orderBy,
        orderDirection,
        limit,
      });
      if (queryResult.isFailure()) {
        return queryResult;
      }

      return this.getFullTableData({
        tableName,
        experiment,
        query: queryResult.value,
      });
    }

    const offset = (page - 1) * pageSize;
    const queryResult = this.buildQuery(experimentId, metadata, {
      orderBy,
      orderDirection,
      limit: pageSize,
      offset,
    });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    return this.getTableDataPage({
      tableName,
      experiment,
      page,
      pageSize,
      rowCount: metadata.rowCount,
      query: queryResult.value,
    });
  }

  /**
   * Distinct values for one column, capped at `limit`. NULLs are stripped
   * server-side so the picker doesn't surface a `(null)` entry.
   */
  async getDistinctColumnValues(params: {
    experimentId: string;
    tableName: string;
    column: string;
    limit: number;
  }): Promise<Result<{ values: (string | number)[]; truncated: boolean }>> {
    const { experimentId, tableName, column, limit } = params;

    const metadataResult = await this.databricksPort.getExperimentTableMetadata(experimentId, {
      identifier: tableName,
      includeSchemas: false,
    });
    if (metadataResult.isFailure()) {
      return metadataResult;
    }
    if (metadataResult.value.length === 0) {
      return failure(AppError.notFound(`Table '${tableName}' not found in experiment`));
    }

    const { tableType } = metadataResult.value[0];

    const queryResult = this.databricksPort.buildExperimentQuery({
      tableName,
      tableType,
      experimentId,
      columns: [column],
      distinct: true,
      orderBy: column,
      orderDirection: "ASC",
      // +1 so we can detect truncation: if the SQL returned exactly limit+1
      // rows, the column has more values than we returned.
      limit: limit + 1,
    });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const dataResult = await this.executeQuery(queryResult.value);
    if (dataResult.isFailure()) {
      return dataResult;
    }

    // Truncation is detected from the raw fetched count (query asked for
    // limit + 1): null/empty filtering below must not influence it.
    const truncated = dataResult.value.rows.length > limit;

    // SchemaData.rows is `(string | null)[][]`; single-column response means
    // each row is `[value]`. Drop nulls/blanks so the picker doesn't surface
    // a `(null)` entry.
    const raw = dataResult.value.rows
      .map((row) => row[0])
      .filter((v): v is string => v != null && v !== "");
    const trimmed = raw.slice(0, limit);

    // Coerce to a number only when the column's own type is numeric, so a
    // string column with numeric-looking codes (e.g. "007") keeps its form.
    const columnType = dataResult.value.columns[0]?.type_text;
    const isNumericColumn = isNumericType(columnType) || isDecimalType(columnType);
    const values: (string | number)[] = trimmed.map((v) => {
      if (!isNumericColumn) {
        return v;
      }
      const n = Number(v);
      return Number.isFinite(n) && v.trim() !== "" ? n : v;
    });

    return success({ values, truncated });
  }

  private buildQuery(
    experimentId: string,
    metadata: ExperimentTableMetadata,
    options: {
      columns?: string[];
      filters?: FilterCondition[];
      aggregation?: AggregationSpec;
      orderBy?: string;
      orderDirection?: "ASC" | "DESC";
      limit?: number;
      offset?: number;
    } = {},
  ): Result<string> {
    const { columns, filters, aggregation, orderBy, orderDirection, limit, offset } = options;
    const {
      identifier: tableName,
      tableType,
      macroSchema,
      questionsSchema,
      customMetadataSchema,
      uploadSchema,
    } = metadata;

    const config = (() => {
      if (tableType === "macro") {
        return MACRO_TABLE_CONFIG;
      }
      if (tableType === "upload") {
        return UPLOAD_TABLE_CONFIG;
      }
      return STATIC_TABLE_CONFIG[tableName];
    })();

    if (!config) {
      return failure(
        AppError.internal(
          `No table configuration found for static table '${tableName}'`,
          "UNKNOWN_TABLE_CONFIG",
        ),
      );
    }

    const exceptColumns = [...config.exceptColumns];
    const variants: { columnName: string; schema: string }[] = [];

    if (config.variantColumns.includes("macro_output")) {
      if (macroSchema) {
        variants.push({ columnName: "macro_output", schema: macroSchema });
      } else {
        exceptColumns.push("macro_output");
      }
    }

    if (config.variantColumns.includes("questions_data")) {
      if (questionsSchema) {
        variants.push({ columnName: "questions_data", schema: questionsSchema });
      } else {
        exceptColumns.push("questions_data");
      }
    }

    if (config.variantColumns.includes("custom_metadata")) {
      if (customMetadataSchema) {
        variants.push({ columnName: "custom_metadata", schema: customMetadataSchema });
      } else {
        exceptColumns.push("custom_metadata");
      }
    }

    if (config.variantColumns.includes("uploaded_data")) {
      if (uploadSchema) {
        variants.push({ columnName: "uploaded_data", schema: uploadSchema });
      } else {
        exceptColumns.push("uploaded_data");
      }
    }

    return this.databricksPort.buildExperimentQuery({
      tableName,
      tableType,
      experimentId,
      columns,
      variants: variants.length > 0 ? variants : undefined,
      exceptColumns: exceptColumns.length > 0 ? exceptColumns : undefined,
      filters,
      aggregation,
      orderBy,
      orderDirection,
      limit,
      offset,
    });
  }

  /**
   * Execute a generated SQL; on failure log the SQL too, since errors like
   * `UNRESOLVED_COLUMN` depend on the exact compiled query.
   */
  private async executeQuery(query: string): Promise<Result<SchemaData>> {
    const dataResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      query,
    );
    if (dataResult.isFailure()) {
      this.logger.error({
        msg: "Experiment data query failed",
        sql: query,
        error: dataResult.error.message,
      });
    }
    return dataResult;
  }

  private async getFullTableData(params: {
    tableName: string;
    experiment: ExperimentDto;
    query: string;
  }): Promise<Result<TableDataDto[]>> {
    const { tableName, experiment, query } = params;

    const dataResult = await this.executeQuery(query);
    if (dataResult.isFailure()) {
      return dataResult;
    }

    const totalRows = dataResult.value.totalRows;

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: this.databricksPort.CENTRUM_SCHEMA_NAME,
        data: this.transformSchemaData(dataResult.value, experiment),
        page: 1,
        pageSize: totalRows,
        totalRows,
        totalPages: 1,
      },
    ]);
  }

  private async getTableDataPage(params: {
    tableName: string;
    experiment: ExperimentDto;
    page: number;
    pageSize: number;
    rowCount: number;
    query: string;
  }): Promise<Result<TableDataDto[]>> {
    const { tableName, experiment, page, pageSize, rowCount, query } = params;

    const totalPages = Math.ceil(rowCount / pageSize);

    const dataResult = await this.executeQuery(query);
    if (dataResult.isFailure()) {
      return dataResult;
    }

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: this.databricksPort.CENTRUM_SCHEMA_NAME,
        data: this.transformSchemaData(dataResult.value, experiment),
        page,
        pageSize,
        totalRows: rowCount,
        totalPages,
      },
    ]);
  }

  /**
   * Convert schema data to DTO and route every row through the
   * contributor anonymiser; the single seat for that policy.
   */
  private transformSchemaData(schemaData: SchemaData, experiment: ExperimentDto): SchemaDataDto {
    const rows = schemaData.rows.map((row) => {
      const dataRow: Record<string, string | null> = {};
      row.forEach((value, index) => {
        dataRow[schemaData.columns[index].name] = value;
      });
      return dataRow;
    });
    return {
      columns: schemaData.columns,
      rows: this.contributorAnonymizer.anonymizeRows(rows, schemaData.columns, experiment),
      totalRows: schemaData.totalRows,
      truncated: schemaData.truncated,
    };
  }
}
