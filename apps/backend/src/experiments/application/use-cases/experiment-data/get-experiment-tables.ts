import { Injectable, Logger, Inject } from "@nestjs/common";

import { ExperimentTableName } from "@repo/api";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DELTA_PORT } from "../../../core/ports/delta.port";
import type { DeltaPort } from "../../../core/ports/delta.port";
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
    @Inject(DELTA_PORT) private readonly deltaPort: DeltaPort,
  ) {
    // Initialize table properties using logical table names from ExperimentTableName
    this.tableProperties = {
      [ExperimentTableName.RAW_DATA]: {
        displayName: "Raw Data",
        defaultSortColumn: "timestamp",
      },
      [ExperimentTableName.DEVICE]: {
        displayName: "Device Metadata",
        defaultSortColumn: "processed_timestamp",
      },
      [ExperimentTableName.RAW_AMBYTE_DATA]: {
        displayName: "Ambyte Raw Data",
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

        const tablesResult = await this.deltaPort.listTables(experiment.name, experimentId);

        if (tablesResult.isFailure()) {
          this.logger.error({
            msg: "Failed to list experiment tables",
            operation: "getExperimentTables",
            experimentId,
            error: tablesResult.error.message,
          });
          return failure(AppError.internal("Failed to retrieve table metadata"));
        }

        const tables: TableMetadataDto[] = [];

        for (const table of tablesResult.value.tables) {
          const rowCountResult = await this.deltaPort.getTableRowCount(
            experiment.name,
            experimentId,
            table.name,
          );
          const totalRows = rowCountResult.isSuccess() ? rowCountResult.value : 0;

          const isKnownTable = table.name in this.tableProperties;
          const properties = this.tableProperties[table.name];

          tables.push({
            name: table.name,
            displayName: isKnownTable ? properties.displayName : `Processed Data (${table.name})`,
            totalRows,
            defaultSortColumn: isKnownTable ? properties.defaultSortColumn : "timestamp",
            errorColumn: isKnownTable ? properties.errorColumn : "macro_error",
          });
        }

        return success(tables);
      },
    );
  }
}
