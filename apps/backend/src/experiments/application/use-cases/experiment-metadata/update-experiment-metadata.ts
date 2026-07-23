import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type {
  ExperimentMetadataDto,
  UpdateExperimentMetadataDto,
} from "../../../core/models/experiment-metadata.model";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateExperimentMetadataUseCase {
  private readonly logger = new Logger(UpdateExperimentMetadataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMetadataRepository: ExperimentMetadataRepository,
  ) {}

  async execute(
    experimentId: string,
    metadataId: string,
    data: UpdateExperimentMetadataDto,
    userId: string,
  ): Promise<Result<ExperimentMetadataDto>> {
    this.logger.log({
      msg: "Updating experiment metadata",
      operation: "updateExperimentMetadata",
      experimentId,
      metadataId,
      userId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found for metadata update",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "updateExperimentMetadata",
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

      const result = await this.experimentMetadataRepository.update(
        metadataId,
        data,
        userId,
        experimentId,
      );

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Experiment metadata updated successfully",
          operation: "updateExperimentMetadata",
          experimentId,
          metadataId,
          userId,
          status: "success",
        });
      } else {
        this.logger.error({
          msg: "Failed to update experiment metadata",
          errorCode: ErrorCodes.EXPERIMENT_METADATA_UPDATE_FAILED,
          operation: "updateExperimentMetadata",
          experimentId,
          metadataId,
          userId,
          error: result.error.message,
        });
      }

      return result;
    });
  }
}
