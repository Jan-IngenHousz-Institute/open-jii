import { Injectable, Logger, Inject } from "@nestjs/common";

import { ExperimentDataQuery } from "@repo/api";

import type { SchemaData } from "../../../../common/modules/databricks/services/sql/sql.types";
import type { Table } from "../../../../common/modules/databricks/services/tables/tables.types";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DELTA_PORT } from "../../../core/ports/delta.port";
import type { DeltaPort } from "../../../core/ports/delta.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Data structure for transformed schema data
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
 * Single table data structure
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
 * Response is an array of table data
 */
export type ExperimentDataDto = TableDataDto[];

@Injectable()
export class GetExperimentDataUseCase {
  private readonly logger = new Logger(GetExperimentDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DELTA_PORT) private readonly deltaPort: DeltaPort,
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

        const { page = 1, pageSize = 5, tableName, columns } = query;

        // Determine the data fetching approach based on the query parameters
        if (tableName && columns) {
          // Specific columns from a table (full data, no pagination)
          this.logger.debug(
            `Fetching columns [${columns}] from table ${tableName} for experiment ${experimentId}`,
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
            experimentId,
          );
        } else {
          // Multiple tables with sample data
          this.logger.debug(`Fetching sample data from all tables for experiment ${experimentId}`);
          return this.fetchMultipleTablesSample(experiment, pageSize, experimentId);
        }
      },
    );
  }

  /**
   * Fetch specific columns from a table with full data (no pagination)
   */
  private async fetchSpecificColumns(
    tableName: string,
    columns: string,
    experiment: ExperimentDto,
    experimentId: string,
  ): Promise<Result<ExperimentDataDto>> {
    // Validate table exists
    const validation = await this.validateTableExists(tableName, experiment.name, experimentId);
    if (validation.isFailure()) {
      return validation;
    }

    // Parse columns
    const columnList = columns.split(",").map((col) => col.trim());

    // Fetch columns using Delta Sharing
    const dataResult = await this.deltaPort.getTableColumns(
      experiment.name,
      experimentId,
      tableName,
      columnList,
    );

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
        name: tableName,
        catalog_name: experiment.name,
        schema_name: schemaName,
        data: this.transformSchemaData(schemaData),
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
    experimentId: string,
  ): Promise<Result<ExperimentDataDto>> {
    // Validate table exists
    const validation = await this.validateTableExists(tableName, experiment.name, experimentId);
    if (validation.isFailure()) {
      return validation;
    }

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

    if (dataResult.isFailure()) {
      this.logger.error(`Failed to get table data for ${tableName}: ${dataResult.error.message}`);
      return failure(AppError.internal(`Failed to get table data: ${dataResult.error.message}`));
    }

    const schemaName = this.buildSchemaName(experiment.name, experimentId);

    return success([
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
    ]);
  }

  /**
   * Fetch multiple tables with sample data
   */
  private async fetchMultipleTablesSample(
    experiment: ExperimentDto,
    pageSize: number,
    experimentId: string,
  ): Promise<Result<ExperimentDataDto>> {
    // List all tables
    const tablesResult = await this.deltaPort.listTables(experiment.name, experimentId);

    if (tablesResult.isFailure()) {
      this.logger.error(`Failed to list tables: ${tablesResult.error.message}`);
      return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
    }

    const response: ExperimentDataDto = [];

    // Fetch sample data for each table
    for (const table of tablesResult.value.tables) {
      const dataResult = await this.deltaPort.getTableData(
        experiment.name,
        experimentId,
        table.name,
        1, // First page
        pageSize,
      );

      const tableInfo: TableDataDto = {
        name: table.name,
        catalog_name: table.catalog_name,
        schema_name: table.schema_name,
        page: 1,
        pageSize,
        totalPages: 1,
        totalRows: 0,
      };

      if (dataResult.isSuccess()) {
        tableInfo.data = this.transformSchemaData(dataResult.value);
        tableInfo.totalRows = dataResult.value.totalRows;
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
    const tablesResult = await this.deltaPort.listTables(experimentName, experimentId);

    if (tablesResult.isFailure()) {
      this.logger.error(`Failed to list tables: ${tablesResult.error.message}`);
      return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
    }

    const tableExists = tablesResult.value.tables.some((table: Table) => table.name === tableName);

    if (!tableExists) {
      this.logger.warn(`Table ${tableName} not found in experiment ${experimentId}`);
      return failure(AppError.notFound(`Table '${tableName}' not found in this experiment`));
    }

    return success(true);
  }

  /**
   * Build schema name from experiment name and ID
   */
  private buildSchemaName(experimentName: string, experimentId: string): string {
    const cleanName = experimentName.toLowerCase().trim().replace(/ /g, "_");
    return `exp_${cleanName}_${experimentId}`;
  }

  /**
   * Transform SchemaData to SchemaDataDto (rows as objects instead of arrays)
   */
  private transformSchemaData(schemaData: SchemaData): SchemaDataDto {
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
