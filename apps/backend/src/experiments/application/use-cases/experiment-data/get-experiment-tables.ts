import { Injectable, Logger, Inject } from "@nestjs/common";

import type { ColumnInfo } from "../../../../common/modules/databricks/services/tables/tables.types";
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
}

/**
 * Response is an array of table metadata
 */
export type ExperimentTablesMetadataDto = TableMetadataDto[];

@Injectable()
export class GetExperimentTablesUseCase {
  private readonly logger = new Logger(GetExperimentTablesUseCase.name);

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

        // 1. Get macro tables from centrum.experiment_macros
        const macrosQuery = this.databricksPort.buildMacrosMetadataQuery(experimentId);

        const macrosResult = await this.databricksPort.executeSqlQuery("centrum", macrosQuery);

        if (macrosResult.isSuccess()) {
          // Add each macro as a table
          for (const row of macrosResult.value.rows) {
            const macroFilename = row[0] ?? "";
            const macroName = row[1] ?? macroFilename.replace(/\.[^/.]+$/, ""); // Use macro_name or fallback to filename without extension
            const totalRows = parseInt((row[2] ?? "0") as string, 10);

            // For macro tables, columns will be available when data is queried
            // using buildVariantParseQuery which expands parsed_output.*
            response.push({
              name: macroFilename,
              displayName: macroName as string,
              totalRows,
              columns: undefined, // Columns determined at query time via VARIANT expansion
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

        // 2. Add sample data table (experiment_raw_data)
        const sampleCountQuery = this.databricksPort.buildRawDataCountQuery(experimentId);

        const sampleCountResult = await this.databricksPort.executeSqlQuery(
          "centrum",
          sampleCountQuery,
        );

        let sampleTotalRows = 0;
        if (sampleCountResult.isSuccess()) {
          sampleTotalRows = parseInt(sampleCountResult.value.rows[0]?.[0] ?? "0", 10);
        }

        // Get sample table schema
        const sampleSchemaResult = await this.databricksPort.listTables("centrum");
        const sampleTable = sampleSchemaResult.isSuccess()
          ? sampleSchemaResult.value.tables.find((t) => t.name === "experiment_raw_data")
          : null;

        response.push({
          name: "sample",
          displayName: "Sample Data",
          totalRows: sampleTotalRows,
          columns: sampleTable?.columns?.map((col) => ({
            name: col.name,
            type_text: col.type_text,
            type_name: col.type_name,
            position: col.position,
            nullable: col.nullable,
            comment: col.comment,
            type_json: col.type_json,
            type_precision: col.type_precision,
            type_scale: col.type_scale,
            partition_index: col.partition_index,
          })),
        });

        // 3. Add device data table (experiment_device_data)
        const deviceCountQuery = this.databricksPort.buildDeviceDataCountQuery(experimentId);

        const deviceCountResult = await this.databricksPort.executeSqlQuery(
          "centrum",
          deviceCountQuery,
        );

        let deviceTotalRows = 0;
        if (deviceCountResult.isSuccess()) {
          deviceTotalRows = parseInt(deviceCountResult.value.rows[0]?.[0] ?? "0", 10);
        }

        // Get device table schema
        const deviceTable = sampleSchemaResult.isSuccess()
          ? sampleSchemaResult.value.tables.find((t) => t.name === "experiment_device_data")
          : null;

        response.push({
          name: "device",
          displayName: "Device Data",
          totalRows: deviceTotalRows,
          columns: deviceTable?.columns?.map((col) => ({
            name: col.name,
            type_text: col.type_text,
            type_name: col.type_name,
            position: col.position,
            nullable: col.nullable,
            comment: col.comment,
            type_json: col.type_json,
            type_precision: col.type_precision,
            type_scale: col.type_scale,
            partition_index: col.partition_index,
          })),
        });

        // Device table should be last
        const deviceTableIndex = response.findIndex((t) => t.name === "device");
        if (deviceTableIndex !== -1 && deviceTableIndex !== response.length - 1) {
          const deviceTableEntry = response.splice(deviceTableIndex, 1)[0];
          response.push(deviceTableEntry);
        }

        return success(response);
      },
    );
  }
}
