import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentMetadataDto } from "../../../core/models/experiment-metadata.model";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentMetadataUseCase {
  private readonly logger = new Logger(GetExperimentMetadataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMetadataRepository: ExperimentMetadataRepository,
  ) {}

  async execute(experimentId: string, userId: string): Promise<Result<ExperimentMetadataDto[]>> {
    this.logger.log({
      msg: "Fetching experiment metadata",
      operation: "getExperimentMetadata",
      experimentId,
      userId,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
        isAdmin: boolean;
      }) => {
        if (!experiment) {
          this.logger.warn({
            msg: "Experiment not found for metadata fetch",
            errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
            operation: "getExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "Unauthorized metadata fetch attempt",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "getExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        const result = await this.experimentMetadataRepository.findAllByExperimentId(experimentId);

        if (result.isFailure()) {
          this.logger.error({
            msg: "Failed to fetch experiment metadata",
            errorCode: ErrorCodes.EXPERIMENT_METADATA_FETCH_FAILED,
            operation: "getExperimentMetadata",
            experimentId,
            userId,
            error: result.error.message,
          });
        }

        return result;
      },
    );
  }
}
