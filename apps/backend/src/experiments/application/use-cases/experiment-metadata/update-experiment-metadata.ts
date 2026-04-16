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
            msg: "Experiment not found for metadata update",
            errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
            operation: "updateExperimentMetadata",
            experimentId,
            metadataId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasArchiveAccess) {
          this.logger.warn({
            msg: "Unauthorized metadata update attempt",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "updateExperimentMetadata",
            experimentId,
            metadataId,
            userId,
          });
          return failure(AppError.forbidden("You do not have write access to this experiment"));
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
      },
    );
  }
}
