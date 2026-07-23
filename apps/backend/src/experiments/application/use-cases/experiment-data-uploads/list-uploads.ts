import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { UploadMetadata } from "../../../core/models/experiment-data-uploads.model";
import { ExperimentDataUploadsRepository } from "../../../core/repositories/experiment-data-uploads.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

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
  ): Promise<Result<{ uploads: UploadMetadata[] }>> {
    this.logger.debug({
      msg: "Listing uploads",
      operation: "listUploads",
      experimentId,
      userId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Experiment not found",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "listUploads",
        experimentId,
      });
      return failure(AppError.notFound("Experiment not found"));
    }

    const uploadsResult = await this.uploadsRepository.listUploads({
      experimentId,
      uploadTableId: query.uploadTableId,
      uploadTableName: query.uploadTableName,
    });
    if (uploadsResult.isFailure()) {
      return failure(uploadsResult.error);
    }

    return success({ uploads: uploadsResult.value });
  }
}
