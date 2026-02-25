import { Injectable, Logger } from "@nestjs/common";

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

  async execute(
    experimentId: string,
    userId: string,
  ): Promise<Result<ExperimentMetadataDto | null>> {
    this.logger.log({
      msg: "Getting metadata for experiment",
      operation: "getExperimentMetadata",
      experimentId,
      userId,
    });

    // Check if experiment exists and if user has access
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
            msg: "Attempt to get metadata of non-existent experiment",
            operation: "getExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasAccess && experiment.visibility !== "public") {
          this.logger.warn({
            msg: "User does not have access to experiment metadata",
            operation: "getExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have access to this experiment"));
        }

        const metadataResult =
          await this.experimentMetadataRepository.findByExperimentId(experimentId);

        if (metadataResult.isFailure()) {
          this.logger.error({
            msg: "Failed to retrieve metadata for experiment",
            operation: "getExperimentMetadata",
            experimentId,
            userId,
            error: metadataResult.error.message,
          });
          return failure(AppError.internal("Failed to retrieve experiment metadata"));
        }

        this.logger.debug({
          msg: "Retrieved metadata for experiment",
          operation: "getExperimentMetadata",
          experimentId,
          userId,
          hasMetadata: metadataResult.value !== null,
        });

        return metadataResult;
      },
    );
  }
}
