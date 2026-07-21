import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError, success } from "../../../../common/utils/fp-utils";
import type { ExportMetadata } from "../../../core/models/experiment-data-exports.model";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Use case for listing all exports for an experiment table
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
  ): Promise<Result<{ exports: ExportMetadata[] }>> {
    this.logger.debug({
      msg: "Listing exports",
      operation: "listExports",
      experimentId,
      userId,
      tableName: query.tableName,
    });

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

    const exportsResult = await this.exportsRepository.listExports({
      experimentId,
      tableName: query.tableName,
    });

    if (exportsResult.isFailure()) {
      this.logger.error({
        msg: "Failed to list exports",
        operation: "listExports",
        experimentId,
        userId,
        tableName: query.tableName,
        error: exportsResult.error.message,
      });
      return failure(AppError.internal("Failed to list exports"));
    }

    const exports = exportsResult.value;
    const activeCount = exports.filter(
      (e) => e.status === "pending" || e.status === "running",
    ).length;
    const completedCount = exports.filter((e) => e.status === "completed").length;

    this.logger.log({
      msg: "Exports listed successfully",
      operation: "listExports",
      experimentId,
      userId,
      tableName: query.tableName,
      activeCount,
      completedCount,
      totalCount: exports.length,
      status: "success",
    });

    return success({
      exports,
    });
  }
}
