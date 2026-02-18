import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError, success } from "../../../../common/utils/fp-utils";
import type {
  ListExportsQuery,
  ListExportsDto,
} from "../../../core/models/experiment-data-exports.model";
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
    query: ListExportsQuery,
  ): Promise<Result<ListExportsDto>> {
    this.logger.debug({
      msg: "Listing exports",
      operation: "listExports",
      experimentId,
      tableName: query.tableName,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    if (accessResult.isFailure()) {
      this.logger.warn({
        msg: "Failed to check access for experiment",
        operation: "listExports",
        experimentId,
      });
      return failure(AppError.internal("Failed to verify experiment access"));
    }

    const { experiment, hasAccess } = accessResult.value;

    if (!experiment) {
      this.logger.warn({
        msg: "Experiment not found",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "listExports",
        experimentId,
      });
      return failure(AppError.notFound("Experiment not found"));
    }

    if (!hasAccess && experiment.visibility !== "public") {
      this.logger.warn({
        msg: "Access denied to experiment",
        errorCode: ErrorCodes.FORBIDDEN,
        operation: "listExports",
        experimentId,
        userId,
      });
      return failure(AppError.forbidden("Access denied to this experiment"));
    }

    // Get all exports (active and completed) from repository
    const exportsResult = await this.exportsRepository.listExports({
      experimentId,
      tableName: query.tableName,
    });

    if (exportsResult.isFailure()) {
      this.logger.error({
        msg: "Failed to list exports",
        operation: "listExports",
        experimentId,
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
