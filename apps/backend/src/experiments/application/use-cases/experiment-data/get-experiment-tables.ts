import { Injectable, Logger, Inject } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface TableMetadataDto {
  name: string;
  displayName: string;
  totalRows: number;
  defaultSortColumn?: string;
  errorColumn?: string;
}

export type ExperimentTablesMetadataDto = TableMetadataDto[];

@Injectable()
export class GetExperimentTablesUseCase {
  private readonly logger = new Logger(GetExperimentTablesUseCase.name);

  // Static table properties for known physical tables
  private readonly tableProperties: Record<
    string,
    { displayName: string; defaultSortColumn?: string; errorColumn?: string }
  >;

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {
    // Initialize table properties using logical table names from ExperimentTableName
    this.tableProperties = {
      raw_data: {
        displayName: "Raw Data",
        defaultSortColumn: "timestamp",
      },
      device: {
        displayName: "Device Metadata",
        defaultSortColumn: "processed_timestamp",
      },
      raw_ambyte_data: {
        displayName: "Ambyte Trace Data",
        defaultSortColumn: "processed_at",
      },
    };
  }

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

        const metadataResult = await this.databricksPort.getExperimentTableMetadata(experimentId, {
          includeSchemas: false,
        });

        if (metadataResult.isFailure()) {
          this.logger.error({
            msg: "Failed to get experiment table metadata",
            operation: "getExperimentTables",
            experimentId,
            error: metadataResult.error.message,
          });
          return failure(AppError.internal("Failed to retrieve table metadata"));
        }

        const tables = metadataResult.value.map(({ tableName, rowCount }) => {
          const isKnownTable = tableName in this.tableProperties;
          const properties = this.tableProperties[tableName];

          if (isKnownTable) {
            return {
              name: tableName,
              displayName: properties.displayName,
              totalRows: rowCount,
              defaultSortColumn: properties.defaultSortColumn,
              errorColumn: properties.errorColumn,
            };
          }

          return {
            name: tableName,
            displayName: `Processed Data (${tableName})`,
            totalRows: rowCount,
            defaultSortColumn: "timestamp",
            errorColumn: "macro_error",
          };
        });

        return success(tables);
      },
    );
  }
}
