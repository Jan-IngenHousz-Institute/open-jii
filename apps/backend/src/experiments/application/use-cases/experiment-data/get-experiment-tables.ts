import { Injectable, Logger, Inject } from "@nestjs/common";

import { ExperimentTableName } from "@repo/api";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Column information structure
 */
export interface ColumnInfoDto {
  name: string;
  type_text: string;
  type_name: string;
  position: number;
  nullable?: boolean;
  comment?: string;
  type_json?: string;
  type_precision?: number;
  type_scale?: number;
  partition_index?: number;
}

/**
 * Table metadata structure
 */
export interface TableMetadataDto {
  name: string;
  displayName: string;
  totalRows: number;
  columns?: ColumnInfoDto[];
  defaultSortColumn?: string;
  errorColumn?: string;
}

/**
 * Response is an array of table metadata
 */
export type ExperimentTablesMetadataDto = TableMetadataDto[];

@Injectable()
export class GetExperimentTablesUseCase {
  private readonly logger = new Logger(GetExperimentTablesUseCase.name);

  private readonly tableDisplayNames: Record<string, string> = {
    [ExperimentTableName.RAW_DATA]: "Raw Data",
    [ExperimentTableName.DEVICE]: "Device Metadata",
    [ExperimentTableName.RAW_AMBYTE_DATA]: "Ambyte Trace Data",
  };

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
  ): Promise<Result<ExperimentTablesMetadataDto>> {
    this.logger.log({
      msg: "Getting experiment tables metadata",
      operation: "getExperimentTables",
      experimentId,
      userId,
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
            operation: "getExperimentTables",
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User attempted to access tables without proper permissions",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "getExperimentTables",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        // Query centrum schema for experiment tables
        const response: ExperimentTablesMetadataDto = [];

        // 1. First, get centrum tables metadata to access macro table properties
        const tablesResult = await this.databricksPort.listTables(
          this.databricksPort.CENTRUM_SCHEMA_NAME,
        );

        if (tablesResult.isFailure()) {
          this.logger.error({
            msg: "Failed to list centrum tables",
            operation: "getExperimentTables",
            experimentId,
            error: tablesResult.error.message,
          });
          return failure(AppError.internal("Failed to retrieve table metadata"));
        }
        // 2. Get macro tables from centrum.experiment_macros
        // First, find the enriched macro data table to get its properties
        const macroDataTable = tablesResult.value.tables.find(
          (t) => t.name === this.databricksPort.MACRO_DATA_TABLE_NAME,
        );
        const macroTableProperties = macroDataTable?.properties;

        const macrosQuery = this.databricksPort.buildExperimentCountQuery(
          ExperimentTableName.MACRO_DATA,
          experimentId,
        );

        const macrosResult = await this.databricksPort.executeSqlQuery(
          this.databricksPort.CENTRUM_SCHEMA_NAME,
          macrosQuery,
        );

        if (macrosResult.isSuccess()) {
          // Add each macro as a table, inheriting properties from the actual macro data table
          for (const row of macrosResult.value.rows) {
            const macroFilename = row[0];
            const macroName = row[1];
            const totalRows = parseInt(row[2] ?? "0", 10);

            // Skip rows with missing critical fields (indicates data quality issue)
            if (!macroFilename || !macroName) {
              this.logger.warn({
                msg: "Skipping macro with missing filename or name",
                operation: "getExperimentTables",
                experimentId,
                macroFilename,
                macroName,
              });
              continue;
            }

            // For macro tables, columns will be available when data is queried
            // using buildVariantParseQuery which expands parsed_output.*
            // Inherit properties like error_column from the actual macro data table
            response.push({
              name: macroFilename,
              displayName: `Processed Data (${macroName})`,
              totalRows,
              columns: undefined, // Columns determined at query time via VARIANT expansion
              errorColumn: macroTableProperties?.error_column ?? "macro_error", // will remove this fallback after i run the pipeline to actually update the table props
            });
          }
        } else {
          this.logger.warn({
            msg: "Failed to query experiment_macros",
            operation: "getExperimentTables",
            experimentId,
            error: macrosResult.error.message,
          });
        }
        // 3. Find enriched_experiment_raw_data table
        const sampleTable = tablesResult.value.tables.find(
          (t) => t.name === this.databricksPort.RAW_DATA_TABLE_NAME,
        );
        if (sampleTable) {
          const sampleCountQuery = this.databricksPort.buildExperimentCountQuery(
            ExperimentTableName.RAW_DATA,
            experimentId,
          );
          const sampleCountResult = await this.databricksPort.executeSqlQuery(
            this.databricksPort.CENTRUM_SCHEMA_NAME,
            sampleCountQuery,
          );
          const sampleTotalRows = sampleCountResult.isSuccess()
            ? parseInt(sampleCountResult.value.rows[0]?.[0] ?? "0", 10)
            : 0;

          response.push({
            name: ExperimentTableName.RAW_DATA,
            displayName: this.tableDisplayNames[ExperimentTableName.RAW_DATA],
            totalRows: sampleTotalRows,
            columns: sampleTable.columns,
            defaultSortColumn: sampleTable.properties?.default_sort_column,
            errorColumn: sampleTable.properties?.error_column,
          });
        }

        // 4. Find experiment_device_data table
        const deviceTable = tablesResult.value.tables.find(
          (t) => t.name === this.databricksPort.DEVICE_DATA_TABLE_NAME,
        );
        if (deviceTable) {
          const deviceCountQuery = this.databricksPort.buildExperimentCountQuery(
            ExperimentTableName.DEVICE,
            experimentId,
          );
          const deviceCountResult = await this.databricksPort.executeSqlQuery(
            this.databricksPort.CENTRUM_SCHEMA_NAME,
            deviceCountQuery,
          );
          const deviceTotalRows = deviceCountResult.isSuccess()
            ? parseInt(deviceCountResult.value.rows[0]?.[0] ?? "0", 10)
            : 0;

          response.push({
            name: ExperimentTableName.DEVICE,
            displayName: this.tableDisplayNames[ExperimentTableName.DEVICE],
            totalRows: deviceTotalRows,
            columns: deviceTable.columns,
            defaultSortColumn: deviceTable.properties?.default_sort_column,
            errorColumn: deviceTable.properties?.error_column,
          });
        }

        // 5. Find raw_ambyte_data table
        const ambyteTable = tablesResult.value.tables.find(
          (t) => t.name === this.databricksPort.RAW_AMBYTE_DATA_TABLE_NAME,
        );
        if (ambyteTable) {
          const ambyteCountQuery = this.databricksPort.buildExperimentCountQuery(
            ExperimentTableName.RAW_AMBYTE_DATA,
            experimentId,
          );
          const ambyteCountResult = await this.databricksPort.executeSqlQuery(
            this.databricksPort.CENTRUM_SCHEMA_NAME,
            ambyteCountQuery,
          );
          const ambyteTotalRows = ambyteCountResult.isSuccess()
            ? parseInt(ambyteCountResult.value.rows[0]?.[0] ?? "0", 10)
            : 0;

          response.push({
            name: ExperimentTableName.RAW_AMBYTE_DATA,
            displayName: this.tableDisplayNames[ExperimentTableName.RAW_AMBYTE_DATA],
            totalRows: ambyteTotalRows,
            columns: ambyteTable.columns,
            defaultSortColumn: ambyteTable.properties?.default_sort_column,
            errorColumn: ambyteTable.properties?.error_column,
          });
        }

        // Device table should be last
        const deviceTableIndex = response.findIndex((t) => t.name === ExperimentTableName.DEVICE);
        if (deviceTableIndex !== -1 && deviceTableIndex !== response.length - 1) {
          const deviceTableEntry = response.splice(deviceTableIndex, 1)[0];
          response.push(deviceTableEntry);
        }

        return success(response);
      },
    );
  }
}
