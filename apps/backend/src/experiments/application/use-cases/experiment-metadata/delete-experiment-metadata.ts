import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentMetadataUseCase {
  private readonly logger = new Logger(DeleteExperimentMetadataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMetadataRepository: ExperimentMetadataRepository,
  ) {}

  async execute(experimentId: string, metadataId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting experiment metadata",
      operation: "deleteExperimentMetadata",
      experimentId,
      metadataId,
      userId,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        experiment,
        hasArchiveAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        hasArchiveAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Experiment not found for metadata deletion",
            errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
            operation: "deleteExperimentMetadata",
            experimentId,
            metadataId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasArchiveAccess) {
          this.logger.warn({
            msg: "Unauthorized metadata deletion attempt",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "deleteExperimentMetadata",
            experimentId,
            metadataId,
            userId,
          });
          return failure(AppError.forbidden("You do not have write access to this experiment"));
        }

        const deleteResult = await this.experimentMetadataRepository.deleteByMetadataId(
          metadataId,
          experimentId,
        );

        if (deleteResult.isFailure()) {
          this.logger.error({
            msg: "Failed to delete experiment metadata",
            errorCode: ErrorCodes.EXPERIMENT_METADATA_DELETE_FAILED,
            operation: "deleteExperimentMetadata",
            experimentId,
            metadataId,
            userId,
            error: deleteResult.error.message,
          });
          return failure(AppError.internal("Failed to delete metadata"));
        }

        this.logger.log({
          msg: "Experiment metadata deleted successfully",
          operation: "deleteExperimentMetadata",
          experimentId,
          metadataId,
          userId,
          status: "success",
        });

        return success(undefined);
      },
    );
  }
}
