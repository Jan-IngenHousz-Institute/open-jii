import { Injectable, Inject, Logger } from "@nestjs/common";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { Result, success, failure, AppError } from "../../../common/utils/fp-utils";
import { ExperimentDto } from "../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";

export interface SchemaDataDto {
  columns: {
    name: string;
    type_name: string;
    type_text: string;
  }[];
  rows: Record<string, string | null>[];
  totalRows: number;
  truncated: boolean;
}

export interface TableDataDto {
  name: string;
  catalog_name: string;
  schema_name: string;
  data?: SchemaDataDto;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
}

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
      tableName,
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
      tableName,
      {
        macroSchema: metadata.macroSchema ?? undefined,
        questionsSchema: metadata.questionsSchema ?? undefined,
      },
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
   * Get table data download links for efficient large dataset downloads
   */
  async getTableDataForDownload(params: { experimentId: string; tableName: string }): Promise<
    Result<{
      externalLinks: {
        externalLink: string;
        expiration: string;
        totalSize: number;
        rowCount: number;
      }[];
      totalRows: number;
    }>
  > {
    const { experimentId, tableName } = params;

    const metadataResult = await this.databricksPort.getExperimentTableMetadata(experimentId, {
      tableName,
      includeSchemas: true,
    });

    if (metadataResult.isFailure()) return metadataResult;
    if (metadataResult.value.length === 0) {
      return failure(AppError.notFound(`Table '${tableName}' not found in experiment`));
    }

    const metadata = metadataResult.value[0];

    const queryResult = this.buildQuery(experimentId, tableName, {
      macroSchema: metadata.macroSchema ?? undefined,
      questionsSchema: metadata.questionsSchema ?? undefined,
    });
    if (queryResult.isFailure()) return queryResult;

    const dataResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      queryResult.value,
      "EXTERNAL_LINKS",
      "CSV",
    );

    if (dataResult.isFailure()) return dataResult;

    return success({
      externalLinks: dataResult.value.external_links.map((link) => ({
        externalLink: link.external_link,
        expiration: link.expiration,
        totalSize: link.byte_count,
        rowCount: link.row_count,
      })),
      totalRows: dataResult.value.totalRows,
    });
  }

  /**
   * Build query for experiment data based on table name
   * @param tableName - Logical table name from ExperimentTableName enum or macro name
   * @param schemas - Optional schemas from metadata table (macroSchema, questionsSchema)
   */
  private buildQuery(
    experimentId: string,
    tableName: string,
    schemas?: { macroSchema?: string; questionsSchema?: string },
    columns?: string[],
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
    limit?: number,
    offset?: number,
  ): Result<string> {
    // Define exceptColumns based on table type
    const MACRO_EXCEPT_COLUMNS = [
      "experiment_id",
      "raw_id",
      "macro_id",
      "macro_name",
      "macro_filename",
      "date",
    ];

    const exceptColumnsMap: Record<string, string[]> = {
      raw_data: ["experiment_id"],
      device: ["experiment_id"],
      raw_ambyte_data: ["experiment_id"],
    };

    const exceptColumns = [...(exceptColumnsMap[tableName] ?? MACRO_EXCEPT_COLUMNS)];

    // Build variants array based on available schemas
    const variants: { columnName: string; schema: string }[] = [];

    if (schemas?.macroSchema) {
      variants.push({ columnName: "macro_output", schema: schemas.macroSchema });
    } else {
      exceptColumns.push("macro_output");
    }

    if (schemas?.questionsSchema) {
      variants.push({ columnName: "questions_data", schema: schemas.questionsSchema });
    } else {
      exceptColumns.push("questions_data");
    }

    const query = this.databricksPort.buildExperimentQuery({
      tableName,
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
