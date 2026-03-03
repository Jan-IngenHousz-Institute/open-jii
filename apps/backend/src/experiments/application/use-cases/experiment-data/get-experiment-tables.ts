import { Injectable, Logger, Inject } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import {
  STATIC_TABLE_CONFIG,
  MACRO_TABLE_CONFIG,
} from "../../../core/models/experiment-data.model";
import type { ExperimentTableMetadata } from "../../../core/models/experiment-data.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface TableMetadataDto {
  identifier: string;
  tableType: "static" | "macro";
  displayName: string;
  totalRows: number;
  defaultSortColumn?: string;
  errorColumn?: string;
}

export type ExperimentTablesMetadataDto = TableMetadataDto[];

@Injectable()
export class GetExperimentTablesUseCase {
  private readonly logger = new Logger(GetExperimentTablesUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
    private readonly macroRepository: MacroRepository,
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

        const staticMetadata = metadataResult.value.filter((m) => m.tableType === "static");
        const macroMetadata = metadataResult.value.filter((m) => m.tableType === "macro");

        const macroNamesMap = await this.resolveMacroNames(experimentId, macroMetadata);

        const tables = [
          ...staticMetadata.map((m) => this.mapStaticTable(m)),
          ...macroMetadata.map((m) => this.mapMacroTable(m, macroNamesMap)),
        ];

        return success(tables);
      },
    );
  }

  private mapStaticTable({
    identifier,
    tableType,
    rowCount,
  }: ExperimentTableMetadata): TableMetadataDto {
    const config = STATIC_TABLE_CONFIG[identifier];
    return {
      identifier,
      tableType,
      displayName: config?.displayName ?? identifier,
      totalRows: rowCount,
      defaultSortColumn: config?.defaultSortColumn,
      errorColumn: config?.errorColumn,
    };
  }

  private mapMacroTable(
    { identifier, tableType, rowCount }: ExperimentTableMetadata,
    macroNamesMap: Map<string, { name: string; filename: string }>,
  ): TableMetadataDto {
    const macroInfo = macroNamesMap.get(identifier);
    const displayName = macroInfo
      ? `${MACRO_TABLE_CONFIG.displayName} (${macroInfo.name})`
      : `${MACRO_TABLE_CONFIG.displayName} (${identifier})`;

    return {
      identifier,
      tableType,
      displayName,
      totalRows: rowCount,
      defaultSortColumn: MACRO_TABLE_CONFIG.defaultSortColumn,
      errorColumn: MACRO_TABLE_CONFIG.errorColumn,
    };
  }

  private async resolveMacroNames(
    experimentId: string,
    macroMetadata: ExperimentTableMetadata[],
  ): Promise<Map<string, { name: string; filename: string }>> {
    if (macroMetadata.length === 0) {
      return new Map();
    }

    const macroIds = macroMetadata.map((m) => m.identifier);
    const result = await this.macroRepository.findNamesByIds(macroIds);

    if (result.isFailure()) {
      this.logger.warn({
        msg: "Failed to resolve macro display names, falling back to IDs",
        operation: "getExperimentTables",
        experimentId,
        error: result.error.message,
      });
      return new Map();
    }

    return result.value;
  }
}
