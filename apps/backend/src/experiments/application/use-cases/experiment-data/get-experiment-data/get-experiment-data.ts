import { Injectable, Inject, Logger } from "@nestjs/common";

import type { ExperimentDataQuery } from "@repo/api";

import type { SchemaData } from "../../../../../common/modules/databricks/services/sql/sql.types";
import { ErrorCodes } from "../../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";
import { DeviceDataQueryStrategy } from "./strategies/device-data.strategy";
import { MacroDataQueryStrategy } from "./strategies/macro-data.strategy";
import { RawDataQueryStrategy } from "./strategies/raw-data.strategy";

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
 * Response is an array of table data
 */
export type ExperimentDataDto = TableDataDto[];

/**
 * Strategy interface for building queries
 */
export interface ExperimentDataQueryStrategy {
  buildQuery(
    experimentId: string,
    tableName: string,
    columns?: string[],
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
    limit?: number,
    offset?: number,
  ): Promise<Result<string>>;
}

/**
 * Main use case for getting experiment data
 */
@Injectable()
export class GetExperimentDataUseCase {
  private readonly logger = new Logger(GetExperimentDataUseCase.name);
  private readonly strategies: Map<string, ExperimentDataQueryStrategy>;

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
    private readonly rawDataStrategy: RawDataQueryStrategy,
    private readonly deviceDataStrategy: DeviceDataQueryStrategy,
    private readonly macroDataStrategy: MacroDataQueryStrategy,
  ) {
    this.strategies = new Map<string, ExperimentDataQueryStrategy>([
      ["sample", this.rawDataStrategy],
      ["device", this.deviceDataStrategy],
      ["macro", this.macroDataStrategy],
    ]);
  }

  /**
   * Execute the use case
   */
  async execute(
    experimentId: string,
    userId: string,
    query: ExperimentDataQuery,
  ): Promise<Result<ExperimentDataDto>> {
    this.logger.log({
      msg: "Getting experiment data",
      operation: "getExperimentData",
      experimentId,
      userId,
      query,
    });

    // Check if experiment exists and user has access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        hasAccess,
        experiment,
      }: {
        hasAccess: boolean;
        experiment: ExperimentDto | null;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Experiment not found",
            errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
            operation: "getExperimentData",
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User attempted to access experiment data without permission",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "getExperimentData",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        const {
          page = 1,
          pageSize = 5,
          tableName,
          columns,
          orderBy,
          orderDirection = "ASC",
        } = query;

        if (!tableName) {
          this.logger.warn({
            msg: "tableName parameter is required",
            operation: "getExperimentData",
            experimentId,
          });
          return failure(AppError.badRequest("tableName parameter is required"));
        }

        // Select strategy based on table name
        const strategy = this.strategies.get(tableName);
        if (!strategy) {
          return failure(AppError.badRequest(`Unknown table: ${tableName}`));
        }

        // Build query with appropriate parameters
        const parsedColumns = columns?.split(",").map((c) => c.trim());
        const offset = columns ? undefined : (page - 1) * pageSize;
        const limit = columns ? undefined : pageSize;

        const queryResult = await strategy.buildQuery(
          experimentId,
          tableName,
          parsedColumns,
          orderBy,
          orderDirection,
          limit,
          offset,
        );
        if (queryResult.isFailure()) return queryResult;

        // Fetch based on whether specific columns were requested
        return columns
          ? this.fetchTableDataSpecificColumns({
              tableName,
              experiment,
              query: queryResult.value,
            })
          : this.fetchTableDataPaginated({
              tableName,
              experiment,
              experimentId,
              page,
              pageSize,
              query: queryResult.value,
            });
      },
    );
  }

  /**
   * Fetch specific columns from a table with full data (no pagination)
   */
  private async fetchTableDataSpecificColumns(params: {
    tableName: string;
    experiment: ExperimentDto;
    query: string;
  }): Promise<Result<ExperimentDataDto>> {
    const { tableName, experiment, query } = params;

    this.logger.debug({
      msg: "Executing SQL query",
      operation: "fetchTableDataSpecificColumns",
      sqlQuery: query,
    });

    const dataResult = await this.databricksPort.executeSqlQuery("centrum", query);
    if (dataResult.isFailure()) {
      return failure(AppError.internal(`Failed to get table data: ${dataResult.error.message}`));
    }

    const totalRows = dataResult.value.totalRows;

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: "centrum",
        data: this.transformSchemaData(dataResult.value),
        page: 1,
        pageSize: totalRows,
        totalRows,
        totalPages: 1,
      },
    ]);
  }

  /**
   * Fetch table with pagination
   */
  private async fetchTableDataPaginated(params: {
    tableName: string;
    experiment: ExperimentDto;
    experimentId: string;
    page: number;
    pageSize: number;
    query: string;
  }): Promise<Result<ExperimentDataDto>> {
    const { tableName, experiment, experimentId, page, pageSize, query } = params;

    // Get total row count
    const countQuery = this.databricksPort.buildExperimentCountQuery(tableName, experimentId);
    const countResult = await this.databricksPort.executeSqlQuery("centrum", countQuery);
    if (countResult.isFailure()) {
      return failure(AppError.internal(`Failed to get row count: ${countResult.error.message}`));
    }

    const totalRows = parseInt(countResult.value.rows[0]?.[0] ?? "0", 10);
    const totalPages = Math.ceil(totalRows / pageSize);

    const dataResult = await this.databricksPort.executeSqlQuery("centrum", query);
    if (dataResult.isFailure()) {
      return failure(AppError.internal(`Failed to get table data: ${dataResult.error.message}`));
    }

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: "centrum",
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
