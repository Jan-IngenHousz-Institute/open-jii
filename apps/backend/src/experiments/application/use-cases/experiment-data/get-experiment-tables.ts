import { Injectable, Logger, Inject } from "@nestjs/common";

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
      context: GetExperimentTablesUseCase.name,
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
            errorCode: EXPERIMENT_NOT_FOUND,
            operation: "getExperimentTables",
            context: GetExperimentTablesUseCase.name,
            experimentId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }
        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User attempted to access tables without proper permissions",
            errorCode: FORBIDDEN,
            operation: "getExperimentTables",
            context: GetExperimentTablesUseCase.name,
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        if (!experiment.schemaName) {
          this.logger.error({
            msg: "Experiment has no schema name",
            errorCode: EXPERIMENT_SCHEMA_NOT_READY,
            operation: "getExperimentTables",
            context: GetExperimentTablesUseCase.name,
            experimentId,
          });
          return failure(AppError.internal("Experiment schema not provisioned"));
        }

        const schemaName = experiment.schemaName;

        // Get list of tables
        const tablesResult = await this.databricksPort.listTables(schemaName);

        if (tablesResult.isFailure()) {
          return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
        }

        // Filter tables to only include those with downstream: "false" (final/enriched tables for user consumption)
        // and exclude annotations table.
        const finalTables = tablesResult.value.tables.filter(
          (table) => table.properties?.downstream === "false" && table.name !== "annotations",
        );

        const response: ExperimentTablesMetadataDto = [];

        // Fetch row counts for each table
        for (const table of finalTables) {
          // Get total row count
          const countResult = await this.databricksPort.executeSqlQuery(
            schemaName,
            `SELECT COUNT(*) as count FROM ${table.name}`,
          );

          let totalRows = 0;
          if (countResult.isSuccess()) {
            totalRows = parseInt(countResult.value.rows[0]?.[0] ?? "0", 10);
          } else {
            this.logger.warn({
              msg: "Failed to get row count for table",
              operation: "getExperimentTables",
              context: GetExperimentTablesUseCase.name,
              tableName: table.name,
              error: countResult.error.message,
            });
          }

          response.push({
            name: table.name,
            displayName: table.properties?.display_name ?? table.name,
            totalRows,
            columns: table.columns?.map((col) => ({
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
        }

        // Make sure 'device' table is last if it exists
        const deviceTableIndex = response.findIndex((t) => t.name === "device");
        if (deviceTableIndex !== -1 && deviceTableIndex !== response.length - 1) {
          const deviceTable = response.splice(deviceTableIndex, 1)[0];
          response.push(deviceTable);
        }

        return success(response);
      },
    );
  }
}
