import { Injectable, Inject, Logger } from "@nestjs/common";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { Result, success, failure, AppError } from "../../../common/utils/fp-utils";
import { STATIC_TABLE_CONFIG, MACRO_TABLE_CONFIG } from "../models/experiment-data.model";
import type {
  ExperimentTableMetadata,
  SchemaDataDto,
  TableDataDto,
} from "../models/experiment-data.model";
import { ExperimentDto } from "../models/experiment.model";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

/**
 * Repository for experiment data operations
 * Handles data access for experiment schemas and metadata
 */
@Injectable()
export class ExperimentDataRepository {
  private readonly logger = new Logger(ExperimentDataRepository.name);

  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  /**
   * Get table data with automatic metadata fetching for schemas and pagination
   */
  async getTableData(params: {
    experimentId: string;
    experiment: ExperimentDto;
    tableName: string;
    columns?: string[];
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
  }): Promise<Result<TableDataDto[]>> {
    const {
      experimentId,
      experiment,
      tableName,
      columns,
      orderBy,
      orderDirection = "ASC",
      page = 1,
      pageSize = 5,
    } = params;

    const metadataResult = await this.databricksPort.getExperimentTableMetadata(experimentId, {
      identifier: tableName,
      includeSchemas: true,
    });

    if (metadataResult.isFailure()) return metadataResult;
    if (metadataResult.value.length === 0) {
      return failure(AppError.notFound(`Table '${tableName}' not found in experiment`));
    }

    const metadata = metadataResult.value[0];

    // Build query with appropriate parameters
    const offset = columns ? undefined : (page - 1) * pageSize;
    const limit = columns ? undefined : pageSize;

    const queryResult = this.buildQuery(
      experimentId,
      metadata,
      columns,
      orderBy,
      orderDirection,
      limit,
      offset,
    );
    if (queryResult.isFailure()) return queryResult;

    // Fetch based on whether specific columns were requested
    return columns
      ? this.getFullTableData({
          tableName,
          experiment,
          query: queryResult.value,
        })
      : this.getTableDataPage({
          tableName,
          experiment,
          page,
          pageSize,
          rowCount: metadata.rowCount,
          query: queryResult.value,
        });
  }

  /**
   * Build query for experiment data using table metadata for type-aware configuration.
   */
  private buildQuery(
    experimentId: string,
    metadata: ExperimentTableMetadata,
    columns?: string[],
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
    limit?: number,
    offset?: number,
  ): Result<string> {
    const { identifier: tableName, tableType, macroSchema, questionsSchema } = metadata;

    const config = (() => {
      if (tableType === "macro") return MACRO_TABLE_CONFIG;
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

    const query = this.databricksPort.buildExperimentQuery({
      tableName,
      tableType,
      experimentId,
      columns,
      variants: variants.length > 0 ? variants : undefined,
      exceptColumns: exceptColumns.length > 0 ? exceptColumns : undefined,
      orderBy,
      orderDirection,
      limit,
      offset,
    });

    return success(query);
  }

  /**
   * Get full table data with specific columns (no pagination)
   */
  private async getFullTableData(params: {
    tableName: string;
    experiment: ExperimentDto;
    query: string;
  }): Promise<Result<TableDataDto[]>> {
    const { tableName, experiment, query } = params;

    const dataResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      query,
    );
    if (dataResult.isFailure()) return dataResult;

    const totalRows = dataResult.value.totalRows;

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: this.databricksPort.CENTRUM_SCHEMA_NAME,
        data: this.transformSchemaData(dataResult.value),
        page: 1,
        pageSize: totalRows,
        totalRows,
        totalPages: 1,
      },
    ]);
  }

  /**
   * Get table data for a specific page
   * @param rowCount - Total row count from metadata table (avoids separate count query)
   */
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

    const dataResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      query,
    );
    if (dataResult.isFailure()) return dataResult;

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: this.databricksPort.CENTRUM_SCHEMA_NAME,
        data: this.transformSchemaData(dataResult.value),
        page,
        pageSize,
        totalRows: rowCount,
        totalPages,
      },
    ]);
  }

  /**
   * Convert schema data to DTO format
   */
  private transformSchemaData(schemaData: SchemaData): SchemaDataDto {
    return {
      columns: schemaData.columns,
      rows: schemaData.rows.map((row) => {
        const dataRow: Record<string, string | null> = {};
        row.forEach((value, index) => {
          dataRow[schemaData.columns[index].name] = value;
        });
        return dataRow;
      }),
      totalRows: schemaData.totalRows,
      truncated: schemaData.truncated,
    };
  }
}
