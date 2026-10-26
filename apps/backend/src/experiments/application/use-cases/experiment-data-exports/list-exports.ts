import { Injectable, Logger } from "@nestjs/common";

import type { ExperimentListExportsResponse } from "@repo/api/domains/experiment/exports/experiment-exports.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError, success } from "../../../../common/utils/fp-utils";
import { toExportRecord } from "../../../core/models/experiment-data-exports.model";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Use case for listing the latest exports of an experiment table
 */
@Injectable()
export class ListExportsUseCase {
  private readonly logger = new Logger(ListExportsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly exportsRepository: ExperimentDataExportsRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    query: { tableName: string },
  ): Promise<Result<ExperimentListExportsResponse>> {
    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Attempt to list exports of non-existent experiment",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "listExports",
        experimentId,
        userId,
      });
      return failure(AppError.notFound("Experiment not found"));
    }

    const exportsResult = await this.exportsRepository.listForTable(experimentId, query.tableName);
    if (exportsResult.isFailure()) {
      this.logger.error({
        msg: "Failed to list exports",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "listExports",
        experimentId,
        tableName: query.tableName,
        error: exportsResult.error.message,
      });
      return failure(AppError.internal("Failed to list exports"));
    }

    return success({ exports: exportsResult.value.map(toExportRecord) });
  }
}
