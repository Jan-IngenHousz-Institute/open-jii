import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type {
  ExperimentMetadataDto,
  CreateExperimentMetadataDto,
} from "../../../core/models/experiment-metadata.model";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpsertExperimentMetadataUseCase {
  private readonly logger = new Logger(UpsertExperimentMetadataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMetadataRepository: ExperimentMetadataRepository,
  ) {}

  async execute(
    experimentId: string,
    data: CreateExperimentMetadataDto,
    userId: string,
  ): Promise<Result<ExperimentMetadataDto>> {
    this.logger.log({
      msg: "Upserting experiment metadata",
      operation: "upsertExperimentMetadata",
      experimentId,
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
            msg: "Experiment not found for metadata upsert",
            errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
            operation: "upsertExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasArchiveAccess) {
          this.logger.warn({
            msg: "Unauthorized metadata upsert attempt",
            errorCode: ErrorCodes.FORBIDDEN,
            operation: "upsertExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have write access to this experiment"));
        }

        const result = await this.experimentMetadataRepository.upsert(experimentId, data, userId);

        if (result.isSuccess()) {
          this.logger.log({
            msg: "Experiment metadata upserted successfully",
            operation: "upsertExperimentMetadata",
            experimentId,
            metadataId: result.value.metadataId,
            userId,
            status: "success",
          });
        } else {
          this.logger.error({
            msg: "Failed to upsert experiment metadata",
            errorCode: ErrorCodes.EXPERIMENT_METADATA_UPSERT_FAILED,
            operation: "upsertExperimentMetadata",
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
