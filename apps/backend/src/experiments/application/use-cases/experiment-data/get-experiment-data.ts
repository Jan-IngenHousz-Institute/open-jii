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

        // Initialize pagination variables
        const page = query.page || 1;
        const pageSize = query.pageSize || 5; // Default to 5 rows per table

        // Form the schema name based on experiment ID and name
        const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
        const schemaName = `exp_${cleanName}_${experimentId}`;

        try {
          // If table name is specified, fetch data for that single table
          if (query.tableName) {
            this.logger.debug(
              `Fetching data for table ${query.tableName} in experiment ${experimentId}`,
            );

            // First, validate that the table exists by listing all tables
            const tablesResult = await this.databricksPort.listTables(
              experiment.name,
              experimentId,
            );

            if (tablesResult.isFailure()) {
              return failure(
                AppError.internal(`Failed to list tables: ${tablesResult.error.message}`),
              );
            }

            // Check if the specified table exists
            const tableExists = tablesResult.value.tables.some(
              (table: Table) => table.name === query.tableName,
            );

            if (!tableExists) {
              this.logger.warn(`Table ${query.tableName} not found in experiment ${experimentId}`);
              return failure(
                AppError.notFound(`Table '${query.tableName}' not found in this experiment`),
              );
            }

            // Execute SQL query to get experiment data with pagination
            const offset = (page - 1) * pageSize;
            const sqlQuery = `SELECT * FROM ${query.tableName} LIMIT ${pageSize} OFFSET ${offset}`;

            // Get row count first for pagination metadata
            const countResult = await this.databricksPort.executeSqlQuery(
              schemaName,
              `SELECT COUNT(*) as count FROM ${query.tableName}`,
            );

            if (countResult.isFailure()) {
              return failure(
                AppError.internal(`Failed to get row count: ${countResult.error.message}`),
              );
            }

            // Extract count from result
            const totalRows = parseInt(countResult.value.rows[0]?.[0] ?? "0", 10);
            const totalPages = Math.ceil(totalRows / pageSize);

            // Execute the actual data query
            const dataResult = await this.databricksPort.executeSqlQuery(schemaName, sqlQuery);

            if (dataResult.isFailure()) {
              return failure(
                AppError.internal(`Failed to get table data: ${dataResult.error.message}`),
              );
            }

            // Create a single-element array with the table data
            const response: ExperimentDataDto = [
              {
                name: query.tableName,
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
          // Otherwise, list all tables in the schema with their data
          else {
            this.logger.debug(`Listing all tables for experiment ${experimentId}`);

            const tablesResult = await this.databricksPort.listTables(
              experiment.name,
              experimentId,
            );

            if (tablesResult.isFailure()) {
              return failure(
                AppError.internal(`Failed to list tables: ${tablesResult.error.message}`),
              );
            }

            // Create an array of table data objects
            const response: ExperimentDataDto = [];

            // Fetch data for each table
            for (const table of tablesResult.value.tables) {
              // Get sample data
              const sqlQuery = `SELECT * FROM ${table.name} LIMIT ${pageSize}`;
              const dataResult = await this.databricksPort.executeSqlQuery(schemaName, sqlQuery);

              const tableInfo: TableDataDto = {
                name: table.name,
                catalog_name: table.catalog_name,
                schema_name: table.schema_name,
                page,
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
        } catch (error) {
          this.logger.error(
            `Error fetching experiment data: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return failure(
            AppError.internal(
              `Failed to fetch experiment data: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            ),
          );
        }
      },
    );
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
