import { Injectable, Inject, Logger } from "@nestjs/common";
import { Readable } from "stream";

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
   * Export table data as a file by triggering Databricks job and streaming the result
   */
  async exportTableDataAsFile(params: {
    experimentId: string;
    tableName: string;
    format: "csv" | "json" | "parquet";
  }): Promise<Result<{ stream: Readable; filePath: string }>> {
    const { experimentId, tableName, format } = params;

    this.logger.log({
      msg: "Starting data export job",
      operation: "exportTableDataAsFile",
      experimentId,
      tableName,
      format,
    });

    // Get metadata to build the query
    const metadataResult = await this.databricksPort.getExperimentTableMetadata(experimentId, {
      tableName,
      includeSchemas: true,
    });

    if (metadataResult.isFailure()) return metadataResult;
    if (metadataResult.value.length === 0) {
      return failure(AppError.notFound(`Table '${tableName}' not found in experiment`));
    }

    const metadata = metadataResult.value[0];

    // Build the SQL query
    const queryResult = this.buildQuery(experimentId, tableName, {
      macroSchema: metadata.macroSchema ?? undefined,
      questionsSchema: metadata.questionsSchema ?? undefined,
    });
    if (queryResult.isFailure()) return queryResult;

    // Trigger the data export job
    const jobRunResult = await this.databricksPort.triggerDataExportJob(
      experimentId,
      tableName,
      queryResult.value,
    );

    if (jobRunResult.isFailure()) {
      this.logger.error({
        msg: "Failed to trigger data export job",
        operation: "exportTableDataAsFile",
        experimentId,
        tableName,
        error: jobRunResult.error.message,
      });
      return jobRunResult;
    }

    const runId = jobRunResult.value.run_id;

    this.logger.log({
      msg: "Data export job triggered successfully, waiting for completion",
      operation: "exportTableDataAsFile",
      experimentId,
      tableName,
      runId,
    });

    // Wait for job completion (timeout after 5 minutes)
    const completionResult = await this.databricksPort.waitForJobCompletion(runId, 300000);

    if (completionResult.isFailure()) {
      this.logger.error({
        msg: "Data export job failed",
        operation: "exportTableDataAsFile",
        experimentId,
        tableName,
        runId,
        error: completionResult.error.message,
      });
      return completionResult;
    }

    // Parse the job output to get the file path
    const jobStatus = completionResult.value;
    let outputData: any;

    try {
      // Get the notebook output from the first task
      const task = jobStatus.tasks?.[0];
      if (!task?.notebook_output?.result) {
        throw new Error("No notebook output found in job result");
      }

      outputData = JSON.parse(task.notebook_output.result);
    } catch (error) {
      this.logger.error({
        msg: "Failed to parse job output",
        operation: "exportTableDataAsFile",
        experimentId,
        tableName,
        runId,
        error,
      });
      return failure(AppError.internal("Failed to parse data export job output"));
    }

    // Get the file path for the requested format
    const formatPaths: Record<string, string> = {
      csv: outputData.csv_path,
      json: outputData.json_path,
      parquet: outputData.parquet_path,
    };

    const filePath = formatPaths[format];

    if (!filePath) {
      this.logger.error({
        msg: "File path not found in job output",
        operation: "exportTableDataAsFile",
        experimentId,
        tableName,
        format,
        outputData,
      });
      return failure(AppError.internal(`Failed to get ${format} file path from job output`));
    }

    this.logger.log({
      msg: "Data export completed, downloading file",
      operation: "exportTableDataAsFile",
      experimentId,
      tableName,
      format,
      filePath,
    });

    // Download the file as a stream
    const downloadResult = await this.databricksPort.downloadFile(filePath);

    if (downloadResult.isFailure()) {
      this.logger.error({
        msg: "Failed to download exported file",
        operation: "exportTableDataAsFile",
        experimentId,
        tableName,
        filePath,
        error: downloadResult.error.message,
      });
      return downloadResult;
    }

    return success({
      stream: downloadResult.value,
      filePath,
    });
  }

  /**
   * Get table data download links for efficient large dataset downloads
   * @deprecated Use exportTableDataAsFile instead
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

    // Table configuration: defines which columns to exclude and which variant columns exist
    const tableConfig: Record<
      string,
      { exceptColumns: string[]; variantColumns: ("macro_output" | "questions_data")[] }
    > = {
      raw_data: {
        exceptColumns: ["experiment_id"],
        variantColumns: ["questions_data"], // raw_data only has questions_data, not macro_output
      },
      device: {
        exceptColumns: ["experiment_id"],
        variantColumns: [],
      },
      raw_ambyte_data: {
        exceptColumns: ["experiment_id"],
        variantColumns: [],
      },
    };

    // Default for macro tables (any table not in the map above)
    const config = tableConfig[tableName] ?? {
      exceptColumns: MACRO_EXCEPT_COLUMNS,
      variantColumns: ["macro_output", "questions_data"],
    };

    const exceptColumns = [...config.exceptColumns];

    // Build variants array based on available schemas and table's variant columns
    const variants: { columnName: string; schema: string }[] = [];

    // Handle macro_output if this table supports it
    if (config.variantColumns.includes("macro_output")) {
      if (schemas?.macroSchema) {
        variants.push({ columnName: "macro_output", schema: schemas.macroSchema });
      } else {
        exceptColumns.push("macro_output");
      }
    }

    // Handle questions_data if this table supports it
    if (config.variantColumns.includes("questions_data")) {
      if (schemas?.questionsSchema) {
        variants.push({ columnName: "questions_data", schema: schemas.questionsSchema });
      } else {
        exceptColumns.push("questions_data");
      }
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
