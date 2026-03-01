import { Injectable, Logger } from "@nestjs/common";

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

  async execute(experimentId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Deleting metadata for experiment",
      operation: "deleteExperimentMetadata",
      experimentId,
      userId,
    });

    // Check if experiment exists and if user has write access
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
            msg: "Attempt to delete metadata for non-existent experiment",
            operation: "deleteExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasArchiveAccess) {
          this.logger.warn({
            msg: "User does not have write access to experiment",
            operation: "deleteExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have write access to this experiment"));
        }

        // Check if metadata exists
        const existingResult =
          await this.experimentMetadataRepository.findByExperimentId(experimentId);

        if (existingResult.isFailure()) {
          this.logger.error({
            msg: "Failed to check existing metadata",
            operation: "deleteExperimentMetadata",
            experimentId,
            userId,
            error: existingResult.error.message,
          });
          return failure(AppError.internal("Failed to check existing metadata"));
        }

        if (!existingResult.value) {
          this.logger.warn({
            msg: "No metadata found for experiment",
            operation: "deleteExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.notFound("No metadata found for this experiment"));
        }

        // Delete metadata
        const deleteResult =
          await this.experimentMetadataRepository.deleteByExperimentId(experimentId);

        if (deleteResult.isFailure()) {
          this.logger.error({
            msg: "Failed to delete metadata",
            operation: "deleteExperimentMetadata",
            experimentId,
            userId,
            error: deleteResult.error.message,
          });
          return failure(AppError.internal("Failed to delete metadata"));
        }

        this.logger.log({
          msg: "Successfully deleted metadata for experiment",
          operation: "deleteExperimentMetadata",
          experimentId,
          status: "success",
        });

        return success(undefined);
      },
    );
  }
}
