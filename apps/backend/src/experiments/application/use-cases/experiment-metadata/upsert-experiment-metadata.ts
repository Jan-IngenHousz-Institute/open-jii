import { Injectable, Logger } from "@nestjs/common";

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
      msg: "Upserting metadata for experiment",
      operation: "upsertExperimentMetadata",
      experimentId,
      userId,
      columnCount: data.columns.length,
      rowCount: data.rows.length,
    });

    // Validate input
    if (data.columns.length === 0) {
      this.logger.warn({
        msg: "No columns provided for metadata",
        operation: "upsertExperimentMetadata",
        experimentId,
        userId,
      });
      return failure(AppError.badRequest("At least one column is required"));
    }

    // Check if experiment exists and if user has write access
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      ({
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
            msg: "Attempt to upsert metadata for non-existent experiment",
            operation: "upsertExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!hasArchiveAccess) {
          this.logger.warn({
            msg: "User does not have write access to experiment",
            operation: "upsertExperimentMetadata",
            experimentId,
            userId,
          });
          return failure(AppError.forbidden("You do not have write access to this experiment"));
        }

        // Check if metadata already exists
        const existingResult = this.experimentMetadataRepository.findByExperimentId(experimentId);

        if (existingResult.isFailure()) {
          this.logger.error({
            msg: "Failed to check existing metadata",
            operation: "upsertExperimentMetadata",
            experimentId,
            userId,
            error: existingResult.error.message,
          });
          return failure(AppError.internal("Failed to check existing metadata"));
        }

        const existing = existingResult.value;

        if (existing) {
          // Update existing metadata
          this.logger.debug({
            msg: "Updating existing metadata",
            operation: "upsertExperimentMetadata",
            experimentId,
            metadataId: existing.id,
          });

          const updateResult = this.experimentMetadataRepository.update(existing.id, data);

          if (updateResult.isFailure() || !updateResult.value) {
            this.logger.error({
              msg: "Failed to update metadata",
              operation: "upsertExperimentMetadata",
              experimentId,
              userId,
            });
            return failure(AppError.internal("Failed to update metadata"));
          }

          this.logger.log({
            msg: "Successfully updated metadata for experiment",
            operation: "upsertExperimentMetadata",
            experimentId,
            metadataId: updateResult.value.id,
            status: "success",
          });

          return updateResult as Result<ExperimentMetadataDto>;
        }

        // Create new metadata
        this.logger.debug({
          msg: "Creating new metadata",
          operation: "upsertExperimentMetadata",
          experimentId,
        });

        const createResult = this.experimentMetadataRepository.create(experimentId, data, userId);

        if (createResult.isFailure()) {
          this.logger.error({
            msg: "Failed to create metadata",
            operation: "upsertExperimentMetadata",
            experimentId,
            userId,
            error: createResult.error.message,
          });
          return failure(AppError.internal("Failed to create metadata"));
        }

        this.logger.log({
          msg: "Successfully created metadata for experiment",
          operation: "upsertExperimentMetadata",
          experimentId,
          metadataId: createResult.value.id,
          status: "success",
        });

        return createResult;
      },
    );
  }
}
