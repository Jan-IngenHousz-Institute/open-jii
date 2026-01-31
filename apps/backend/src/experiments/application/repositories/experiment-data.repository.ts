import { Injectable, Inject, Logger } from "@nestjs/common";

import { ExperimentTableName, ExperimentTableNameType, zExperimentTableName } from "@repo/api";

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
   * Build query for experiment data based on table name
   */
  async buildQuery(
    experimentId: string,
    tableName: string,
    columns?: string[],
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
    limit?: number,
    offset?: number,
  ): Promise<Result<string>> {
    // Select strategy based on table name
    if (tableName === ExperimentTableName.RAW_DATA) {
      return await this.buildRawDataQuery(
        experimentId,
        tableName,
        columns,
        orderBy,
        orderDirection,
        limit,
        offset,
      );
    } else if (tableName === ExperimentTableName.DEVICE) {
      return this.buildDeviceDataQuery(
        experimentId,
        tableName,
        columns,
        orderBy,
        orderDirection,
        limit,
        offset,
      );
    } else if (tableName === ExperimentTableName.RAW_AMBYTE_DATA) {
      return this.buildAmbyteDataQuery(
        experimentId,
        tableName,
        columns,
        orderBy,
        orderDirection,
        limit,
        offset,
      );
    } else {
      return await this.buildMacroDataQuery(
        experimentId,
        tableName,
        columns,
        orderBy,
        orderDirection,
        limit,
        offset,
      );
    }
  }

  /**
   * Build query for raw data (sample table)
   */
  private async buildRawDataQuery(
    experimentId: string,
    tableName: string,
    columns?: string[],
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
    limit?: number,
    offset?: number,
  ): Promise<Result<string>> {
    // Get questions schema for this experiment
    const questionsSchemaResult = await this.getQuestionsSchema(experimentId);

    if (questionsSchemaResult.isFailure()) {
      // If no questions schema, build query without questions expansion
      this.logger.debug({
        msg: "No questions schema found, building query without questions expansion",
        experimentId,
      });
      const query = this.databricksPort.buildExperimentQuery({
        tableName,
        experimentId,
        columns,
        orderBy,
        orderDirection,
        limit,
        offset,
      });
      return success(query);
    }

    // Build query with questions_data VARIANT expansion
    const query = this.databricksPort.buildExperimentQuery({
      tableName,
      experimentId,
      columns,
      variants: [{ columnName: "questions_data", schema: questionsSchemaResult.value }],
      exceptColumns: ["experiment_id"],
      orderBy,
      orderDirection,
      limit,
      offset,
    });

    return success(query);
  }

  /**
   * Build query for device data
   */
  private buildDeviceDataQuery(
    experimentId: string,
    tableName: string,
    columns?: string[],
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
    limit?: number,
    offset?: number,
  ): Result<string> {
    const query = this.databricksPort.buildExperimentQuery({
      tableName,
      experimentId,
      columns,
      orderBy,
      orderDirection,
      limit,
      offset,
    });

    return success(query);
  }

  /**
   * Build query for ambyte trace data
   */
  private buildAmbyteDataQuery(
    experimentId: string,
    tableName: string,
    columns?: string[],
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
    limit?: number,
    offset?: number,
  ): Result<string> {
    const query = this.databricksPort.buildExperimentQuery({
      tableName,
      experimentId,
      columns,
      orderBy,
      orderDirection,
      limit,
      offset,
    });

    return success(query);
  }

  /**
   * Build query for macro data
   */
  private async buildMacroDataQuery(
    experimentId: string,
    tableName: string,
    columns?: string[],
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
    limit?: number,
    offset?: number,
  ): Promise<Result<string>> {
    const macroSchemaResult = await this.getMacroSchema(experimentId, tableName);
    if (macroSchemaResult.isFailure()) return macroSchemaResult;

    // Get questions schema for this experiment
    const questionsSchemaResult = await this.getQuestionsSchema(experimentId);

    // Hardcoded VARIANT columns for macro data table
    const variants = [{ columnName: "macro_output", schema: macroSchemaResult.value }];

    // Add questions_data if we have the schema
    if (questionsSchemaResult.isSuccess()) {
      variants.push({ columnName: "questions_data", schema: questionsSchemaResult.value });
    }

    const query = this.databricksPort.buildExperimentQuery({
      tableName,
      experimentId,
      columns,
      variants,
      exceptColumns: [
        "experiment_id",
        "raw_id",
        "macro_id",
        "macro_name",
        "macro_filename",
        "date",
      ],
      orderBy,
      orderDirection,
      limit,
      offset,
    });

    return success(query);
  }

  /**
   * Get VARIANT schema for questions in an experiment
   */
  async getQuestionsSchema(experimentId: string): Promise<Result<string>> {
    const schemaQuery = this.databricksPort.buildSchemaLookupQuery({
      schema: this.databricksPort.CENTRUM_SCHEMA_NAME,
      experimentId,
      schemaType: "questions",
    });

    const result = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      schemaQuery,
    );

    if (result.isFailure() || result.value.rows.length === 0) {
      this.logger.debug({
        msg: "No questions found in experiment",
        operation: "getQuestionsSchema",
        experimentId,
      });
      return failure(AppError.notFound(`No questions found in this experiment`));
    }

    const schemaValue = result.value.rows[0]?.[0];
    if (typeof schemaValue !== "string" || !schemaValue) {
      this.logger.error({
        msg: "Invalid schema value returned from database",
        operation: "getQuestionsSchema",
        experimentId,
        schemaValue,
      });
      return failure(AppError.internal("Invalid questions schema format"));
    }

    return success(schemaValue);
  }

  /**
   * Get VARIANT schema for a macro in an experiment
   */
  async getMacroSchema(experimentId: string, macroFilename: string): Promise<Result<string>> {
    const schemaQuery = this.databricksPort.buildSchemaLookupQuery({
      schema: this.databricksPort.CENTRUM_SCHEMA_NAME,
      experimentId,
      schemaType: "macros",
      macroFilename,
    });

    const result = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      schemaQuery,
    );

    if (result.isFailure() || result.value.rows.length === 0) {
      this.logger.warn({
        msg: "Macro not found in experiment",
        operation: "getMacroSchema",
        macroFilename,
        experimentId,
      });
      return failure(AppError.notFound(`Macro '${macroFilename}' not found in this experiment`));
    }

    const schemaValue = result.value.rows[0]?.[0];
    if (typeof schemaValue !== "string" || !schemaValue) {
      this.logger.error({
        msg: "Invalid schema value returned from database",
        operation: "getMacroSchema",
        macroFilename,
        experimentId,
        schemaValue,
      });
      return failure(AppError.internal("Invalid macro schema format"));
    }

    return success(schemaValue);
  }

  /**
   * Get full table data with specific columns (no pagination)
   */
  async getFullTableData(params: {
    tableName: string;
    experiment: ExperimentDto;
    query: string;
  }): Promise<Result<TableDataDto[]>> {
    const { tableName, experiment, query } = params;

    this.logger.debug({
      msg: "Executing SQL query",
      operation: "getFullTableData",
      sqlQuery: query,
    });

    const dataResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      query,
    );
    if (dataResult.isFailure()) {
      return failure(AppError.internal(`Failed to get table data: ${dataResult.error.message}`));
    }

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
   */
  async getTableDataPage(params: {
    tableName: string;
    experiment: ExperimentDto;
    experimentId: string;
    page: number;
    pageSize: number;
    query: string;
  }): Promise<Result<TableDataDto[]>> {
    const { tableName, experiment, experimentId, page, pageSize, query } = params;

    // Get total row count
    const countQuery = this.databricksPort.buildExperimentCountQuery(
      zExperimentTableName.safeParse(tableName).success
        ? (tableName as ExperimentTableNameType)
        : ExperimentTableName.MACRO_DATA,
      experimentId,
    );
    const countResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      countQuery,
    );
    if (countResult.isFailure()) {
      return failure(AppError.internal(`Failed to get row count: ${countResult.error.message}`));
    }

    const totalRows = parseInt(countResult.value.rows[0]?.[0] ?? "0", 10);
    const totalPages = Math.ceil(totalRows / pageSize);

    const dataResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      query,
    );
    if (dataResult.isFailure()) {
      return failure(AppError.internal(`Failed to get table data: ${dataResult.error.message}`));
    }

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: this.databricksPort.CENTRUM_SCHEMA_NAME,
        data: this.transformSchemaData(dataResult.value),
        page,
        pageSize,
        totalRows,
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
