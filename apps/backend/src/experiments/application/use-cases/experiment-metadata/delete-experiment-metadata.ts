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

    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
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

      // Authorization is enforced declaratively by @CanAccess on the route.
      // Archived-state handling remains here because it is a domain rule
      // describing which writes are legal, not who may write.
      if (experiment.status === "archived") {
        return failure(AppError.forbidden("Cannot modify an archived experiment"));
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
    });
  }
}
