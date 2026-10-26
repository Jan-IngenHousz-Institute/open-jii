import { Injectable, Logger } from "@nestjs/common";

import type { ExperimentListUploadsResponse } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { toUploadRecord } from "../../../core/models/experiment-data-uploads.model";
import { ExperimentDataUploadsRepository } from "../../../core/repositories/experiment-data-uploads.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Use case for listing the latest uploads of an experiment, optionally of one upload table
 */
@Injectable()
export class ListUploadsUseCase {
  private readonly logger = new Logger(ListUploadsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly uploadsRepository: ExperimentDataUploadsRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    query: { uploadTableId?: string; uploadTableName?: string },
  ): Promise<Result<ExperimentListUploadsResponse>> {
    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Attempt to list uploads of non-existent experiment",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "listUploads",
        experimentId,
        userId,
      });
      return failure(AppError.notFound("Experiment not found"));
    }

    const uploadsResult = await this.uploadsRepository.listForExperiment(experimentId, query);
    if (uploadsResult.isFailure()) {
      this.logger.error({
        msg: "Failed to list uploads",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "listUploads",
        experimentId,
        error: uploadsResult.error.message,
      });
      return failure(AppError.internal("Failed to list uploads"));
    }

    return success({ uploads: uploadsResult.value.map(toUploadRecord) });
  }
}
