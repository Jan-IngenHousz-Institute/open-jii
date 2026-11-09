import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentDataOutboxRepository } from "../../../core/repositories/experiment-data-outbox.repository";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ExperimentDataOutboxWorker } from "../../services/experiment-data-outbox.worker";

@Injectable()
export class DeleteExperimentMetadataUseCase {
  private readonly logger = new Logger(DeleteExperimentMetadataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly metadataRepository: ExperimentMetadataRepository,
    private readonly outboxRepository: ExperimentDataOutboxRepository,
    private readonly outboxWorker: ExperimentDataOutboxWorker,
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

      const written = await this.metadataRepository.transaction(async (tx) => {
        if (await this.metadataRepository.delete(tx, experimentId, metadataId)) {
          await this.outboxRepository.owe(tx, [
            { recordType: "metadata_sheet", recordId: metadataId, experimentId },
          ]);
        }
      });

      if (written.isFailure()) {
        this.logger.error({
          msg: "Failed to delete experiment metadata",
          errorCode: ErrorCodes.EXPERIMENT_METADATA_DELETE_FAILED,
          operation: "deleteExperimentMetadata",
          experimentId,
          metadataId,
          userId,
          error: written.error.message,
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
      this.outboxWorker.nudge();

      return success(undefined);
    });
  }
}
