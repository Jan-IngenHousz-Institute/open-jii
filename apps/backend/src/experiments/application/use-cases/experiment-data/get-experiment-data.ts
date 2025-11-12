import { Injectable, Logger, Inject } from "@nestjs/common";

import { ExperimentDataQuery } from "@repo/api";

import type { SchemaData } from "../../../../common/modules/databricks/services/sql/sql.types";
import type { Table } from "../../../../common/modules/databricks/services/tables/tables.types";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Data structure based on DataBricks
 */
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

/**
 * Single table data structure that forms our array response
 */
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
 * Response is now an array of table data
 */
export type ExperimentDataDto = TableDataDto[];

@Injectable()
export class GetExperimentDataUseCase {
  private readonly logger = new Logger(GetExperimentDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
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

        // Determine the data fetching approach based on the query parameters
        const {
          page = 1,
          pageSize = 5,
          tableName,
          columns,
          orderBy,
          orderDirection = "ASC",
        } = query;

        // Form the schema name based on experiment ID and name
        const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
        const schemaName = `exp_${cleanName}_${experimentId}`;

        // Direct conditional logic for data fetching
        if (tableName && columns) {
          // Specific columns from a table, full data
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
        } else if (tableName) {
          // Single table with pagination
          this.logger.debug(
            `Fetching data for experiment ${experimentId} in paginated mode (table: ${tableName})`,
          );
          return await this.fetchSingleTablePaginated(
            tableName,
            schemaName,
            experiment,
            page,
            pageSize,
            experimentId,
            orderBy,
            orderDirection,
          );
        } else {
          // Multiple tables with sample data
          this.logger.debug(`Fetching data for experiment ${experimentId} in sampling mode`);
          return await this.fetchMultipleTablesSample(
            schemaName,
            experiment,
            pageSize,
            experimentId,
          );
        }
      },
    );
  }

  private async getOrderByClause(
    experimentName: string,
    experimentId: string,
    tableName: string,
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
  ) {
    if (orderBy?.trim()) {
      // Add ORDER BY clause if specified
      return success(` ORDER BY \`${orderBy.trim()}\` ${orderDirection ?? "ASC"}`);
    } else {
      // Check if a 'timestamp' column exists for default ordering
      const metadataResult = await this.databricksPort.getTableMetadata(
        experimentName,
        experimentId,
        tableName,
      );
      if (metadataResult.isFailure()) {
        return failure(
          AppError.internal(`Failed to get metadata: ${metadataResult.error.message}`),
        );
      }
      if (metadataResult.value.has("timestamp")) {
        return success(" ORDER BY timestamp DESC");
      }
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
    // Validate table exists
    const tableExists = await this.validateTableExists(tableName, experiment.name, experimentId);
    if (tableExists.isFailure()) {
      return tableExists;
    }

    // Build SQL query with specific columns
    const columnList = columns
      .split(",")
      .map((col) => `\`${col.trim()}\``)
      .join(", ");

    let sqlQuery = `SELECT ${columnList} FROM ${tableName}`;

    // Add ORDER BY clause
    const orderByClauseResult = await this.getOrderByClause(
      experiment.name,
      experimentId,
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
      return failure(AppError.internal(`Failed to get table data: ${dataResult.error.message}`));
    }

    const totalRows = dataResult.value.totalRows;

    // Create response
    const response: ExperimentDataDto = [
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: schemaName,
        data: this.transformSchemaData(dataResult.value),
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
    experimentId: string,
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
  ): Promise<Result<ExperimentDataDto>> {
    // Validate table exists
    const tableExists = await this.validateTableExists(tableName, experiment.name, experimentId);
    if (tableExists.isFailure()) {
      return tableExists;
    }

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
    const orderByClauseResult = await this.getOrderByClause(
      experiment.name,
      experimentId,
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
        name: tableName,
        catalog_name: experiment.name,
        schema_name: schemaName,
        data: this.transformSchemaData(dataResult.value),
        page,
        pageSize,
        totalRows,
        totalPages,
      },
    ];

    return success(response);
  }

  /**
   * Fetch multiple tables with sample data
   */
  private async fetchMultipleTablesSample(
    schemaName: string,
    experiment: ExperimentDto,
    pageSize: number,
    experimentId: string,
  ): Promise<Result<ExperimentDataDto>> {
    const tablesResult = await this.databricksPort.listTables(experiment.name, experimentId);

    if (tablesResult.isFailure()) {
      return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
    }

    const response: ExperimentDataDto = [];

    // Fetch sample data for each table
    for (const table of tablesResult.value.tables) {
      let sqlQuery = `SELECT * FROM ${table.name}`;

      // Add ORDER BY clause
      const orderByClauseResult = await this.getOrderByClause(
        experiment.name,
        experimentId,
        table.name,
      );
      if (orderByClauseResult.isFailure()) {
        return orderByClauseResult;
      }
      sqlQuery += orderByClauseResult.value;
      sqlQuery += ` LIMIT ${pageSize}`;

      const dataResult = await this.databricksPort.executeSqlQuery(schemaName, sqlQuery);

      const tableInfo: TableDataDto = {
        name: table.name,
        catalog_name: table.catalog_name,
        schema_name: table.schema_name,
        page: 1,
        pageSize,
        totalPages: 1,
        totalRows: dataResult.isSuccess() ? dataResult.value.totalRows : 0,
      };

      if (dataResult.isSuccess()) {
        tableInfo.data = this.transformSchemaData(dataResult.value);
      } else {
        this.logger.warn(
          `Failed to get sample data for table ${table.name}: ${dataResult.error.message}`,
        );
      }

      response.push(tableInfo);
    }

    return success(response);
  }

  /**
   * Validate that a table exists in the experiment
   */
  private async validateTableExists(
    tableName: string,
    experimentName: string,
    experimentId: string,
  ): Promise<Result<boolean>> {
    const tablesResult = await this.databricksPort.listTables(experimentName, experimentId);

    if (tablesResult.isFailure()) {
      return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
    }

    const tableExists = tablesResult.value.tables.some((table: Table) => table.name === tableName);

    if (!tableExists) {
      this.logger.warn(`Table ${tableName} not found in experiment ${experimentId}`);
      return failure(AppError.notFound(`Table '${tableName}' not found in this experiment`));
    }

    return success(true);
  }

  private transformSchemaData(schemaData: SchemaData) {
    const result: SchemaDataDto = {
      columns: schemaData.columns,
      rows: [],
      totalRows: schemaData.totalRows,
      truncated: schemaData.truncated,
    };
    schemaData.rows.forEach((row) => {
      const dataRow: Record<string, string | null> = {};
      row.forEach((dataColumn, index) => {
        dataRow[schemaData.columns[index].name] = dataColumn;
      });
      result.rows.push(dataRow);
    });
    return result;
  }
}
