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
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);
    if (accessResult.isFailure()) {
      return failure(accessResult.error);
    }
    const { experiment, hasAccess } = accessResult.value;
    if (!experiment) {
      this.logger.warn({
        msg: "Experiment not found",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "listUploads",
        experimentId,
      });
      return failure(AppError.notFound("Experiment not found"));
    }
    if (!hasAccess && experiment.visibility !== "public") {
      return failure(AppError.forbidden("Access denied to this experiment"));
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
