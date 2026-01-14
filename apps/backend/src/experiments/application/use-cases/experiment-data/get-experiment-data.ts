import { Injectable, Logger, Inject } from "@nestjs/common";

import type { ExperimentDataQuery } from "@repo/api";

import type { SchemaData } from "../../../../common/modules/databricks/services/sql/sql.types";
import type { Table } from "../../../../common/modules/databricks/services/tables/tables.types";
import {
  EXPERIMENT_NOT_FOUND,
  FORBIDDEN,
  EXPERIMENT_SCHEMA_NOT_READY,
} from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import type { SchemaDataDto } from "../../services/data-transformation/data-transformation.service";
import { UserTransformationService } from "../../services/data-transformation/user-metadata/user-transformation.service";

/**
 * Single table data structure that forms our array response
 */
export interface TableDataDto {
  name: string;
  displayName: string;
  catalog_name: string;
  schema_name: string;
  data?: SchemaDataDto;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
}

/**
 * Response is now an array of table data
 */
export type ExperimentDataDto = TableDataDto[];

@Injectable()
export class GetExperimentDataUseCase {
  private readonly logger = new Logger(GetExperimentDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
    private readonly userTransformationService: UserTransformationService,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    query: ExperimentDataQuery,
  ): Promise<Result<ExperimentDataDto>> {
    this.logger.log({
      msg: "Getting experiment data",
      operation: "getExperimentData",
      context: GetExperimentDataUseCase.name,
      experimentId,
      userId,
      query: JSON.stringify(query),
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
            errorCode: EXPERIMENT_NOT_FOUND,
            operation: "getExperimentData",
            context: GetExperimentDataUseCase.name,
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User attempted to access experiment data without permission",
            errorCode: FORBIDDEN,
            operation: "getExperimentData",
            context: GetExperimentDataUseCase.name,
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        if (!experiment.schemaName) {
          this.logger.error({
            msg: "Experiment has no schema name",
            errorCode: EXPERIMENT_SCHEMA_NOT_READY,
            operation: "getExperimentData",
            context: GetExperimentDataUseCase.name,
            experimentId,
          });
          return failure(AppError.internal("Experiment schema not provisioned"));
        }

        // Determine the data fetching approach based on the query parameters
        const {
          page = 1,
          pageSize = 5,
          tableName,
          columns,
          orderBy,
          orderDirection = "ASC",
        } = query;

        const schemaName = experiment.schemaName;

        // Direct conditional logic for data fetching
        if (tableName && columns) {
          // Specific columns from a table, full data
          this.logger.debug({
            msg: "Fetching data in full-columns mode",
            operation: "getExperimentData",
            context: GetExperimentDataUseCase.name,
            experimentId,
            tableName,
            columns,
          });
          return await this.fetchSpecificColumns(
            tableName,
            columns,
            schemaName,
            experiment,
            experimentId,
            orderBy,
            orderDirection,
          );
        } else if (tableName) {
          // Single table with pagination
          this.logger.debug({
            msg: "Fetching data in paginated mode",
            operation: "getExperimentData",
            context: GetExperimentDataUseCase.name,
            experimentId,
            tableName,
          });
          return await this.fetchSingleTablePaginated(
            tableName,
            schemaName,
            experiment,
            page,
            pageSize,
            orderBy,
            orderDirection,
          );
        } else {
          // No tableName provided - this is deprecated behavior
          this.logger.warn({
            msg: "Deprecated: getExperimentData called without tableName",
            operation: "getExperimentData",
            context: GetExperimentDataUseCase.name,
            experimentId,
          });
          return failure(
            AppError.badRequest(
              "tableName parameter is required. Use /tables endpoint for metadata or /tables/:tableName for data.",
            ),
          );
        }
      },
    );
  }

  private getOrderByClause(
    schemaName: string,
    tableName: string,
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
  ) {
    if (orderBy?.trim()) {
      // Add ORDER BY clause if specified
      return success(` ORDER BY \`${orderBy.trim()}\` ${orderDirection ?? "ASC"}`);
    } else {
      return success("");
    }
  }

  /**
   * Fetch specific columns from a table with full data (no pagination)
   */
  private async fetchSpecificColumns(
    tableName: string,
    columns: string,
    schemaName: string,
    experiment: ExperimentDto,
    experimentId: string,
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
  ): Promise<Result<ExperimentDataDto>> {
    // Validate table exists and get table metadata in one call
    const tableResult = await this.validateTableExists(tableName, schemaName);
    if (tableResult.isFailure()) {
      return tableResult;
    }
    const table = tableResult.value;

    // Build SQL query with specific columns
    const columnList = columns
      .split(",")
      .map((col) => `\`${col.trim()}\``)
      .join(", ");

    let sqlQuery = `SELECT ${columnList} FROM ${tableName}`;

    // Add ORDER BY clause
    const orderByClauseResult = this.getOrderByClause(
      schemaName,
      tableName,
      orderBy,
      orderDirection,
    );
    if (orderByClauseResult.isFailure()) {
      return orderByClauseResult;
    }
    sqlQuery += orderByClauseResult.value;

    this.logger.debug({
      msg: "Executing SQL query",
      operation: "fetchSpecificColumns",
      context: GetExperimentDataUseCase.name,
      sqlQuery,
    });

    // Execute the query
    const dataResult = await this.databricksPort.executeSqlQuery(schemaName, sqlQuery);

    if (dataResult.isFailure()) {
      return failure(AppError.internal(`Failed to get table data: ${dataResult.error.message}`));
    }

    const totalRows = dataResult.value.totalRows;

    // Create response
    const response: ExperimentDataDto = [
      {
        name: table.name,
        displayName: table.properties?.display_name ?? table.name,
        catalog_name: experiment.name,
        schema_name: schemaName,
        data: await this.transformSchemaData(dataResult.value),
        page: 1,
        pageSize: totalRows,
        totalRows,
        totalPages: 1,
      },
    ];

    return success(response);
  }

  /**
   * Fetch single table with pagination
   */
  private async fetchSingleTablePaginated(
    tableName: string,
    schemaName: string,
    experiment: ExperimentDto,
    page: number,
    pageSize: number,
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
  ): Promise<Result<ExperimentDataDto>> {
    // Validate table exists and get table metadata in one call
    const tableResult = await this.validateTableExists(tableName, schemaName);
    if (tableResult.isFailure()) {
      return tableResult;
    }
    const table = tableResult.value;

    // Get total row count for pagination
    const countResult = await this.databricksPort.executeSqlQuery(
      schemaName,
      `SELECT COUNT(*) as count FROM ${tableName}`,
    );

    if (countResult.isFailure()) {
      return failure(AppError.internal(`Failed to get row count: ${countResult.error.message}`));
    }

    const totalRows = parseInt(countResult.value.rows[0]?.[0] ?? "0", 10);
    const totalPages = Math.ceil(totalRows / pageSize);

    // Build paginated query
    const offset = (page - 1) * pageSize;
    let sqlQuery = `SELECT * FROM ${tableName}`;

    // Add ORDER BY clause
    const orderByClauseResult = this.getOrderByClause(
      schemaName,
      tableName,
      orderBy,
      orderDirection,
    );
    if (orderByClauseResult.isFailure()) {
      return orderByClauseResult;
    }
    sqlQuery += orderByClauseResult.value;

    sqlQuery += ` LIMIT ${pageSize} OFFSET ${offset}`;

    // Execute the query
    const dataResult = await this.databricksPort.executeSqlQuery(schemaName, sqlQuery);

    if (dataResult.isFailure()) {
      return failure(AppError.internal(`Failed to get table data: ${dataResult.error.message}`));
    }

    // Create response
    const response: ExperimentDataDto = [
      {
        name: table.name,
        displayName: table.properties?.display_name ?? table.name,
        catalog_name: experiment.name,
        schema_name: schemaName,
        data: await this.transformSchemaData(dataResult.value),
        page,
        pageSize,
        totalRows,
        totalPages,
      },
    ];

    return success(response);
  }

  /**
   * Validate that a table exists in the experiment and is accessible (downstream: "false")
   * Returns the table object if valid, allowing callers to use it without additional lookups
   */
  private async validateTableExists(tableName: string, schemaName: string): Promise<Result<Table>> {
    const tablesResult = await this.databricksPort.listTables(schemaName);

    if (tablesResult.isFailure()) {
      return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
    }

    const table = tablesResult.value.tables.find((table: Table) => table.name === tableName);

    if (!table) {
      this.logger.warn({
        msg: "Table not found in schema",
        operation: "validateTableExists",
        context: GetExperimentDataUseCase.name,
        tableName,
        schemaName,
      });
      return failure(AppError.notFound(`Table '${tableName}' not found in this experiment`));
    }

    // Check if table is marked as accessible to users (downstream: "false")
    if (table.properties?.downstream !== "false") {
      this.logger.warn({
        msg: "Table is not accessible (intermediate processing table)",
        operation: "validateTableExists",
        context: GetExperimentDataUseCase.name,
        tableName,
        schemaName,
      });
      return failure(
        AppError.forbidden(
          `Table '${tableName}' is not accessible. Only final processed tables are available.`,
        ),
      );
    }

    return success(table);
  }

  /**
   * Transform schema data using transformation services
   */
  private async transformSchemaData(schemaData: SchemaData): Promise<SchemaDataDto> {
    // Check if user transformation can be applied
    if (this.userTransformationService.canTransform(schemaData)) {
      return await this.userTransformationService.transformData(schemaData);
    }

    // If no transformation services apply, convert to DTO format
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
