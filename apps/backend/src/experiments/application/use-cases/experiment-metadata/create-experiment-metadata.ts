import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type {
  ExperimentMetadataDto,
  CreateExperimentMetadataDto,
} from "../../../core/models/experiment-metadata.model";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentMetadataWarehouseRepository } from "../../../core/repositories/experiment-metadata-warehouse.repository";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class CreateExperimentMetadataUseCase {
  private readonly logger = new Logger(CreateExperimentMetadataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly metadataWarehouseRepository: ExperimentMetadataWarehouseRepository,
    private readonly metadataRepository: ExperimentMetadataRepository,
  ) {}

  async execute(
    experimentId: string,
    data: CreateExperimentMetadataDto,
    userId: string,
  ): Promise<Result<ExperimentMetadataDto>> {
    this.logger.log({
      msg: "Creating experiment metadata",
      operation: "createExperimentMetadata",
      experimentId,
      userId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found for metadata creation",
          errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
          operation: "createExperimentMetadata",
          experimentId,
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

      const metadataId = randomUUID();
      const now = new Date();
      const result = await this.metadataWarehouseRepository.create(
        experimentId,
        metadataId,
        data,
        userId,
        now,
      );

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Experiment metadata created successfully",
          operation: "createExperimentMetadata",
          experimentId,
          metadataId,
          userId,
          status: "success",
        });

        // Postgres follows the lakehouse until pages read it, and the metadata-sheets-move runbook
        // fills in what a failed copy missed.
        const copied = await this.metadataRepository.insert({
          id: metadataId,
          experimentId,
          metadata: data.metadata,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        });
        if (copied.isFailure()) {
          this.logger.warn({
            msg: "Experiment metadata not copied to Postgres",
            operation: "createExperimentMetadata",
            experimentId,
            metadataId,
            error: copied.error.message,
          });
        }
      } else {
        this.logger.error({
          msg: "Failed to create experiment metadata",
          errorCode: ErrorCodes.EXPERIMENT_METADATA_CREATE_FAILED,
          operation: "createExperimentMetadata",
          experimentId,
          userId,
          error: result.error.message,
        });
      }

      return result;
    });
  }
}
