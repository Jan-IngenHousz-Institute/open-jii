import { Injectable, Logger, Inject } from "@nestjs/common";

import type { ExperimentDataQuery } from "@repo/api";

import type { SchemaData } from "../../../../common/modules/databricks/services/sql/sql.types";
import type { Table } from "../../../../common/modules/databricks/services/tables/tables.types";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DELTA_PORT } from "../../../core/ports/delta.port";
import type { DeltaPort } from "../../../core/ports/delta.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import type { SchemaDataDto } from "../../services/data-transformation/data-transformation.service";
import { UserTransformationService } from "../../services/data-transformation/user-metadata/user-transformation.service";

/**
 * Single table data structure
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
 * Response is an array of table data
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
    this.logger.log(
      `Getting experiment data for experiment ${experimentId}, user ${userId}, query: ${JSON.stringify(
        query,
      )}`,
    );

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
          this.logger.warn(`Experiment with ID ${experimentId} not found`);
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn(
            `User ${userId} attempted to access data of experiment ${experimentId} without proper permissions`,
          );
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        if (!experiment.schemaName) {
          this.logger.error(`Experiment ${experimentId} has no schema name`);
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
          // Specific columns from a table (full data, no pagination)
          this.logger.debug(
            `Fetching data for experiment ${experimentId} in full-columns mode (table: ${tableName}) (columns: ${columns})`,
          );
          return await this.fetchSpecificColumns(
            tableName,
            columns,
            schemaName,
            experiment,
            experimentId,
            orderBy,
            orderDirection,
          );
          return this.fetchSpecificColumns(tableName, columns, experiment, experimentId);
        } else if (tableName) {
          // Single table with pagination
          this.logger.debug(
            `Fetching paginated data from table ${tableName} for experiment ${experimentId}`,
          );
          return this.fetchSingleTablePaginated(
            tableName,
            experiment,
            page,
            pageSize,
            orderBy,
            orderDirection,
          );
        } else {
          // No tableName provided - this is deprecated behavior
          this.logger.warn(
            `Deprecated: getExperimentData called without tableName for experiment ${experimentId}`,
          );
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

    this.logger.debug(`Executing SQL query: ${sqlQuery}`);

    // Execute the query
    const dataResult = await this.databricksPort.executeSqlQuery(schemaName, sqlQuery);

    if (dataResult.isFailure()) {
      this.logger.error(
        `Failed to get columns from table ${tableName}: ${dataResult.error.message}`,
      );
      return failure(AppError.internal(`Failed to get table data: ${dataResult.error.message}`));
    }

    const schemaData = dataResult.value;
    const totalRows = schemaData.totalRows;
    const schemaName = this.buildSchemaName(experiment.name, experimentId);

    return success([
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
    ]);
  }

  /**
   * Fetch single table with pagination
   */
  private async fetchSingleTablePaginated(
    tableName: string,
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

    // Get row count
    const countResult = await this.deltaPort.getTableRowCount(
      experiment.name,
      experimentId,
      tableName,
    );

    if (countResult.isFailure()) {
      this.logger.error(
        `Failed to get row count for table ${tableName}: ${countResult.error.message}`,
      );
      return failure(AppError.internal(`Failed to get row count: ${countResult.error.message}`));
    }

    const totalRows = countResult.value;
    const totalPages = Math.ceil(totalRows / pageSize);

    // Get paginated data
    const dataResult = await this.deltaPort.getTableData(
      experiment.name,
      experimentId,
      tableName,
      page,
      pageSize,
    );

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
      this.logger.error(`Failed to get table data for ${tableName}: ${dataResult.error.message}`);
      return failure(AppError.internal(`Failed to get table data: ${dataResult.error.message}`));
    }

    const schemaName = this.buildSchemaName(experiment.name, experimentId);

    return success([
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
    ]);
  }

  /**
   * Validate that a table exists in the experiment and is accessible (downstream: "false")
   * Returns the table object if valid, allowing callers to use it without additional lookups
   */
  private async validateTableExists(tableName: string, schemaName: string): Promise<Result<Table>> {
    const tablesResult = await this.databricksPort.listTables(schemaName);

    if (tablesResult.isFailure()) {
      this.logger.error(`Failed to list tables: ${tablesResult.error.message}`);
      return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
    }

    const table = tablesResult.value.tables.find((table: Table) => table.name === tableName);

    if (!table) {
      this.logger.warn(`Table ${tableName} not found in schema ${schemaName}`);
      return failure(AppError.notFound(`Table '${tableName}' not found in this experiment`));
    }

    // Check if table is marked as accessible to users (downstream: "false")
    if (table.properties?.downstream !== "false") {
      this.logger.warn(
        `Table ${tableName} in schema ${schemaName} is not accessible (intermediate processing table)`,
      );
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
