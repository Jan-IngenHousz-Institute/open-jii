import { Injectable, Logger } from "@nestjs/common";

import { ExperimentDataQuery } from "@repo/api";

import { DatabricksService } from "../../../../common/services/databricks/databricks.service";
import { SchemaData } from "../../../../common/services/databricks/databricks.types";
import {
  Result,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface ExperimentDataDto {
  tables?: {
    name: string;
    catalog_name: string;
    schema_name: string;
  }[];
  data?: SchemaData;
  tableName?: string;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
}

@Injectable()
export class GetExperimentDataUseCase {
  private readonly logger = new Logger(GetExperimentDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly databricksService: DatabricksService,
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
    const experimentResult =
      await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn(`Experiment with ID ${experimentId} not found`);
        return failure(
          AppError.notFound(`Experiment with ID ${experimentId} not found`),
        );
      }

      // Check if user has access to the experiment
      const accessResult = await this.experimentRepository.hasAccess(
        experimentId,
        userId,
      );

      return accessResult.chain(async (hasAccess: boolean) => {
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn(
            `User ${userId} attempted to access data of experiment ${experimentId} without proper permissions`,
          );
          return failure(
            AppError.forbidden("You do not have access to this experiment"),
          );
        }

        // Initialize response with pagination info
        const page = query.page || 1;
        const pageSize = query.pageSize || 5; // Default to 5 rows per table
        const response: ExperimentDataDto = {
          page,
          pageSize,
          totalPages: 0,
          totalRows: 0,
        };

        // Form the schema name based on experiment ID and name
        const schemaName = `exp_${experiment.name}_${experimentId}`;

        try {
          // If table name is specified, fetch data for that table
          if (query.tableName) {
            this.logger.debug(
              `Fetching data for table ${query.tableName} in experiment ${experimentId}`,
            );

            // Execute SQL query to get experiment data with pagination
            const offset = (page - 1) * pageSize;
            const sqlQuery = `SELECT * FROM ${query.tableName} LIMIT ${pageSize} OFFSET ${offset}`;

            // Get row count first for pagination metadata
            const countResult = await this.databricksService.executeSqlQuery(
              schemaName,
              `SELECT COUNT(*) as count FROM ${query.tableName}`,
            );

            if (countResult.isFailure()) {
              return failure(
                AppError.internal(
                  `Failed to get row count: ${countResult.error.message}`,
                ),
              );
            }

            // Extract count from result
            const totalRows = parseInt(
              countResult.value.rows[0]?.[0] ?? "0",
              10,
            );
            const totalPages = Math.ceil(totalRows / pageSize);

            // Execute the actual data query
            const dataResult = await this.databricksService.executeSqlQuery(
              schemaName,
              sqlQuery,
            );

            if (dataResult.isFailure()) {
              return failure(
                AppError.internal(
                  `Failed to get table data: ${dataResult.error.message}`,
                ),
              );
            }

            response.data = dataResult.value;
            response.tableName = query.tableName;
            response.totalRows = totalRows;
            response.totalPages = totalPages;

            return success(response);
          }
          // Otherwise, list all tables in the schema
          else {
            this.logger.debug(
              `Listing all tables for experiment ${experimentId}`,
            );

            const tablesResult = await this.databricksService.listTables(
              experiment.name,
              experimentId,
            );

            if (tablesResult.isFailure()) {
              return failure(
                AppError.internal(
                  `Failed to list tables: ${tablesResult.error.message}`,
                ),
              );
            }

            response.tables = tablesResult.value.tables;
            response.totalRows = tablesResult.value.tables.length;
            response.totalPages = 1; // Tables listing is not paginated in this implementation

            // Get 5 rows of data for each table
            // We'll create a combined data object that follows SchemaData structure
            const combinedData: SchemaData = {
              columns: [
                {
                  name: "table_name",
                  type_name: "STRING",
                  type_text: "STRING",
                },
                {
                  name: "sample_data",
                  type_name: "STRING",
                  type_text: "STRING",
                },
              ],
              rows: [],
              totalRows: 0,
              truncated: false,
            };

            for (const table of tablesResult.value.tables) {
              const sqlQuery = `SELECT * FROM ${table.name} LIMIT ${pageSize}`;
              const dataResult = await this.databricksService.executeSqlQuery(
                schemaName,
                sqlQuery,
              );

              if (dataResult.isSuccess()) {
                // Add sample data rows for this table
                const tableData = dataResult.value;

                // Create a simplified string representation of the table data
                const sampleData = JSON.stringify(tableData);

                // Add a row for this table
                combinedData.rows.push([table.name, sampleData]);
                combinedData.totalRows += 1;
              } else {
                this.logger.warn(
                  `Failed to get sample data for table ${table.name}: ${dataResult.error.message}`,
                );
                // Still include the table but with error message as sample
                combinedData.rows.push([
                  table.name,
                  `Error retrieving data: ${dataResult.error.message}`,
                ]);
                combinedData.totalRows += 1;
              }
            }

            response.data = combinedData;
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
      });
    });
  }
}
